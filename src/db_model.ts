import { DynamoDBClient, QueryCommand, TransactWriteItem, TransactWriteItemsCommand, TransactionCanceledException } from '@aws-sdk/client-dynamodb';

import {
    DbIndex,
    PaginatedDbResult,
    Document,
    WithTimestamps,
    TrxErrorPayloads,
    StringSafe,
    IndexFieldsMap,
    WithoutDefaults,
    BuildIndexesConfig,
    QueryConfig,
    QueryOneConfig,
} from './types';
import * as DbUtils from './utils';
import { ConditionCheckError, UniqueContraintError } from './errors';

export abstract class DbModel<T extends Document> {
    private static readonly indexValueSeparator = '#';
    private static readonly uniqueSortKeyValue = 'Unique';
    private static readonly client = new DynamoDBClient();

    protected readonly tenantId: string;
    protected readonly entityName: string;

    protected readonly writeIndex: DbIndex;
    protected readonly indexFieldsMap: IndexFieldsMap;

    private items: TransactWriteItem[];
    private errorPayloads: TrxErrorPayloads;

    constructor(tenantId: string, entityName: string, writeIndex: DbIndex, indexFieldsMap: IndexFieldsMap) {
        this.tenantId = tenantId;
        this.entityName = entityName;

        this.writeIndex = writeIndex;
        this.indexFieldsMap = indexFieldsMap;

        this.items = [];
        this.errorPayloads = {};
    }

    // Private methods

    /**
     * Set the error payload for a transaction item
     * @param index The index of the transaction item
     * @param payload The error payload
     */
    private trxSetErrorHandler(reason: 'ConditionalCheckFailed', payload: Error): void {
        const index = this.items.length - 1;
        this.errorPayloads[`${reason}-${index}`] = payload;
    }

    /**
     * Handle transaction errors
     * @param error The error to handle
     */
    private trxHandleError(error: unknown): void {
        if (!(error instanceof TransactionCanceledException)) return;

        error.CancellationReasons?.forEach((reason, index) => {
            if (reason.Code === 'None') {
                // This transaction item was successful, hence some other item failed
                return;
            }

            const key = `${reason.Code}-${index}`;

            if (key in this.errorPayloads) {
                const error = this.errorPayloads[key];

                throw error;
            }

            throw new Error(`A conditional check error has not been handled ${index} ${JSON.stringify(reason)}`);
        });
    }

    /**
     * Build indexes from a resource
     * @param newResource The new resource
     * @param oldResource The old resource
     * @param indexConfig The index configuration
     * @param config GSIs might be build with optional values, also you might want to build a partial index for non-exact query purposes
     * @returns The built indexes
     */
    private buildIndexes(resource: Document, indexConfig: IndexFieldsMap, config: BuildIndexesConfig): Record<string, string> {
        const indexValues: Record<string, string> = {};

        Object.entries(indexConfig)
            .filter(([key]) => config.onlyFields === undefined || config.onlyFields.includes(key))
            .forEach(([indexName, indexConfig]) => {
                let indexValue = [this.tenantId, ...indexConfig].join(DbModel.indexValueSeparator);
                indexValue = DbUtils.replaceFieldWithValue(indexValue, resource);

                if (indexValue.includes('{')) {
                    indexValue = indexValue.split('{')[0];
                }

                indexValues[indexName] = indexValue;
            });

        return indexValues;
    }

    // Protected methods

    /**
     * Queries for resources in a table
     * @param queryIndexValues Used to fill the query index
     * @param queryIndex The index to query
     * @param config The query configuration
     * @returns The resources
     */
    protected async query(queryIndexValues: Partial<T>, queryIndex: DbIndex, config: QueryConfig): Promise<PaginatedDbResult<WithTimestamps<T>[]>> {
        const indexValues = this.buildIndexes(queryIndexValues, this.indexFieldsMap, {
            truncateAtFirstEmpty: config.skMatch !== 'exact',
            onlyFields: [queryIndex.partitionKey, queryIndex.sortKey],
        });
        const keyConditionExpression = DbUtils.getKeyConditionExpression(queryIndex, config.skMatch);

        const expressionAttributeValues = DbUtils.marshall({
            ':pk': indexValues[queryIndex.partitionKey],
            ':sk': indexValues[queryIndex.sortKey],
        });

        let exclusiveStartKey;
        if (config.lastId) {
            exclusiveStartKey = DbUtils.decodeLastEvaluatedKey(config.lastId);
        }

        const command = new QueryCommand({
            TableName: queryIndex.tableName,
            IndexName: queryIndex.indexName ?? undefined,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: config.limit,
            ExclusiveStartKey: exclusiveStartKey,
            ScanIndexForward: config.sort !== 'desc',
        });

        const response = await DbModel.client.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error(`Failed to query for resources ${JSON.stringify(response)}`);
        }

        if (response.Items === undefined || response.Items.length === 0) return { data: [] };

        const lastId = DbUtils.encodeLastEvaluatedKey(response.LastEvaluatedKey);

        const items = response.Items
            .map(DbUtils.unmarshallReservedKeys)
            .map(data => DbUtils.removeIndexProperties(data, this.indexFieldsMap));

        return {
            data: items as WithTimestamps<T>[],
            lastId,
        };
    }

    /**
     * Find a single resource in a table
     * @param queryIndexValues Used to fill the query index
     * @param queryIndex The index to query
     * @returns The resource or null if not found
     */
    protected async queryOne(queryIndexValues: Partial<T>, queryIndex: DbIndex, config: QueryOneConfig): Promise<WithTimestamps<T> | null> {
        const results = await this.query(queryIndexValues, queryIndex, { ...config, limit: 1 });
        if (results.data.length === 0) return null;

        if (results.data.length > 1) {
            throw new Error(`Found more than one resource for ${JSON.stringify(queryIndexValues)}`);
        }

        return results.data[0];
    }

    /**
     * Insert a single item in a transaction
     * @param data The data to insert
     * @param pkValue The partition key value
     * @param skValue The sort key value
     * @param error The error to throw if the operation fails
     * @returns The ID of the inserted item
     */
    protected trxInsertOne(data: WithoutDefaults<T>): { id: string, createdAt: number, updatedAt: number } {
        const id = DbUtils.generateUUID();
        const now = Date.now() / 1000;

        const createdAt = now;
        const updatedAt = now;

        const baseData = { ...data, id, createdAt, updatedAt };

        const indexFields = this.buildIndexes(baseData, this.indexFieldsMap, { truncateAtFirstEmpty: false });

        const createData: Record<string, unknown> = { ...baseData, ...indexFields };

        this.items.push({
            Put: {
                TableName: this.writeIndex.tableName,
                ConditionExpression: `attribute_not_exists(${this.writeIndex.partitionKey}) AND attribute_not_exists(${this.writeIndex.sortKey})`,
                Item: DbUtils.marshall(createData, { removeUndefinedValues: true }),
            },
        });

        const error = new Error(`Failed to insert resource ${this.entityName}`);
        this.trxSetErrorHandler('ConditionalCheckFailed', error);

        return { id, createdAt, updatedAt };
    }

    /**
     * Insert an update operation in a transaction
     * @param data The data to update
     * @param pkValue The partition key value
     * @param skValue The sort key value
     * @param error The error to throw if the operation fails
     */
    protected trxUpdateOne(data: Partial<WithoutDefaults<T>>, oldResource: WithoutDefaults<T>, filter: Partial<T>): void {
        const now = Math.trunc(Date.now() / 1000);

        const baseData = {
            ...DbUtils.removeUndefined(data),
            updatedAt: now,
        };

        const resource = DbUtils.mergeResources(oldResource, baseData);
        const indexFields = this.buildIndexes(resource, this.indexFieldsMap, { truncateAtFirstEmpty: false });

        const {
            [this.writeIndex.partitionKey]: pkValue,
            [this.writeIndex.sortKey]: skValue,
            ...queryIndexes
        } = indexFields;

        const updateData = {
            ...baseData,
            ...queryIndexes,
        };

        // TODO: Remove unchanged values from the update data

        const updateExpression = DbUtils.getUpdateExpression(updateData);
        const updateExpressionNames = DbUtils.getExpressionAttributeNames(updateData);
        const updateExpressionValues = DbUtils.getExpressionAttributeValues(updateData);

        // Changed prefixes "fn" and "fv" to avoid conflicts with the update expression
        const filterExpression = DbUtils.getConditionExpression(filter, 'fn', 'fv');
        const filterExpressionNames = DbUtils.getExpressionAttributeNames(filter, 'fn');
        const filterExpressionValues = DbUtils.getExpressionAttributeValues(filter, 'fv');

        const expressionAttributeNames = {
            ...updateExpressionNames,
            ...filterExpressionNames,
        };

        const expressionAttributeValues = {
            ...updateExpressionValues,
            ...filterExpressionValues,
        };

        this.items.push({
            Update: {
                TableName: this.writeIndex.tableName,
                Key: DbUtils.marshall({
                    [this.writeIndex.partitionKey]: pkValue,
                    [this.writeIndex.sortKey]: skValue,
                }),
                ConditionExpression: filterExpression,
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            },
        });

        const error = new Error(`Failed to update resource ${this.entityName}`);
        this.trxSetErrorHandler('ConditionalCheckFailed', error);
    }

    /**
     * Insert a delete operation in a transaction
     * @param pkValue The partition key value
     * @param skValue The sort key value
     * @param error The error to throw if the operation fails
     */
    protected trxDeleteOne(oldResource: Document, filter: Partial<T>): void {
        const writeIndexes = this.buildIndexes(oldResource, this.indexFieldsMap, {
            truncateAtFirstEmpty: false,
            onlyFields: [this.writeIndex.partitionKey, this.writeIndex.sortKey],
        });

        this.items.push({
            Delete: {
                TableName: this.writeIndex.tableName,
                Key: DbUtils.marshall(writeIndexes),
                ConditionExpression: DbUtils.getConditionExpression(filter),
                ExpressionAttributeNames: DbUtils.getExpressionAttributeNames(filter),
                ExpressionAttributeValues: DbUtils.getExpressionAttributeValues(filter),
            },
        });

        const error = new ConditionCheckError(`Failed to delete resource ${this.entityName} ${JSON.stringify(filter)}`);
        this.trxSetErrorHandler('ConditionalCheckFailed', error);
    }

    /**
     * Insert a unique constraint
     * @param values The values to consider unique (order is important)
     * @param error The error to throw if the constraint is already present
     */
    protected trxInsertUniqueConstraint(values: StringSafe[]): void {
        const constraint = {
            [this.writeIndex.partitionKey]: [this.tenantId, this.entityName, ...values].join(DbModel.indexValueSeparator),
            [this.writeIndex.sortKey]: DbModel.uniqueSortKeyValue,
        };

        this.items.push({
            Put: {
                TableName: this.writeIndex.tableName,
                ConditionExpression: `attribute_not_exists(${this.writeIndex.partitionKey}) AND attribute_not_exists(${this.writeIndex.sortKey})`,
                Item: DbUtils.marshall(constraint, { removeUndefinedValues: true }),
            },
        });

        const error = new UniqueContraintError(`Failed to insert unique constraint for one of [${values.join(', ')}]`);
        this.trxSetErrorHandler('ConditionalCheckFailed', error);
    }

    /**
     * Remove a unique constraint
     * @param values The values to consider unique (order is important)
     * @param error The error to throw if the constraint is already present
     */
    protected trxRemoveUniqueConstraint(values: StringSafe[]): void {
        const constraint = {
            [this.writeIndex.partitionKey]: [this.tenantId, this.entityName, ...values].join(DbModel.indexValueSeparator),
            [this.writeIndex.sortKey]: DbModel.uniqueSortKeyValue,
        };

        this.items.push({
            Delete: {
                TableName: this.writeIndex.tableName,
                Key: DbUtils.marshall(constraint),
            },
        });

        const error = new Error(`Failed to delete unique constraint for ${this.entityName} ${values.join(' ')}`);
        this.trxSetErrorHandler('ConditionalCheckFailed', error);
    }

    /**
     * Insert a unique constraint in a transaction
     * @param values The values to insert
     * @param error The error to throw if the operation fails
     */
    protected async trxExecute(): Promise<void> {
        try {
            const command = new TransactWriteItemsCommand({ TransactItems: this.items });

            const response = await DbModel.client.send(command);
            if (response.$metadata.httpStatusCode !== 200) {
                throw new Error(`Failed to execute transactions ${JSON.stringify(response)}`);
            }
        } catch (error) {
            this.trxHandleError(error);
            throw error;
        } finally {
            this.items = [];
            this.errorPayloads = {};
        }
    }
}
