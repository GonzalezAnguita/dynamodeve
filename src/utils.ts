import { v7 as randomUUID } from 'uuid';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';

import { DbIndex, SkMatch, Document, IndexFieldsMap } from './types';

export { unmarshall, marshall };

// Dynamo Reserved Keywords

/** https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html */
const RESERVED_KEYWORDS = [
    'ABORT',
    'ABSOLUTE',
    'ACTION',
    'ADD',
    'AFTER',
    'AGENT',
    'AGGREGATE',
    'ALL',
    'ALLOCATE',
    'ALTER',
    'ANALYZE',
    'AND',
    'ANY',
    'ARCHIVE',
    'ARE',
    'ARRAY',
    'AS',
    'ASC',
    'ASCII',
    'ASENSITIVE',
    'ASSERTION',
    'ASYMMETRIC',
    'AT',
    'ATOMIC',
    'ATTACH',
    'ATTRIBUTE',
    'AUTH',
    'AUTHORIZATION',
    'AUTHORIZE',
    'AUTO',
    'AVG',
    'BACK',
    'BACKUP',
    'BASE',
    'BATCH',
    'BEFORE',
    'BEGIN',
    'BETWEEN',
    'BIGINT',
    'BINARY',
    'BIT',
    'BLOB',
    'BLOCK',
    'BOOLEAN',
    'BOTH',
    'BREADTH',
    'BUCKET',
    'BULK',
    'BY',
    'BYTE',
    'CALL',
    'CALLED',
    'CALLING',
    'CAPACITY',
    'CASCADE',
    'CASCADED',
    'CASE',
    'CAST',
    'CATALOG',
    'CHAR',
    'CHARACTER',
    'CHECK',
    'CLASS',
    'CLOB',
    'CLOSE',
    'CLUSTER',
    'CLUSTERED',
    'CLUSTERING',
    'CLUSTERS',
    'COALESCE',
    'COLLATE',
    'COLLATION',
    'COLLECTION',
    'COLUMN',
    'COLUMNS',
    'COMBINE',
    'COMMENT',
    'COMMIT',
    'COMPACT',
    'COMPILE',
    'COMPRESS',
    'CONDITION',
    'CONFLICT',
    'CONNECT',
    'CONNECTION',
    'CONSISTENCY',
    'CONSISTENT',
    'CONSTRAINT',
    'CONSTRAINTS',
    'CONSTRUCTOR',
    'CONSUMED',
    'CONTINUE',
    'CONVERT',
    'COPY',
    'CORRESPONDING',
    'COUNT',
    'COUNTER',
    'CREATE',
    'CROSS',
    'CUBE',
    'CURRENT',
    'CURSOR',
    'CYCLE',
    'DATA',
    'DATABASE',
    'DATE',
    'DATETIME',
    'DAY',
    'DEALLOCATE',
    'DEC',
    'DECIMAL',
    'DECLARE',
    'DEFAULT',
    'DEFERRABLE',
    'DEFERRED',
    'DEFINE',
    'DEFINED',
    'DEFINITION',
    'DELETE',
    'DELIMITED',
    'DEPTH',
    'DEREF',
    'DESC',
    'DESCRIBE',
    'DESCRIPTOR',
    'DETACH',
    'DETERMINISTIC',
    'DIAGNOSTICS',
    'DIRECTORIES',
    'DISABLE',
    'DISCONNECT',
    'DISTINCT',
    'DISTRIBUTE',
    'DO',
    'DOMAIN',
    'DOUBLE',
    'DROP',
    'DUMP',
    'DURATION',
    'DYNAMIC',
    'EACH',
    'ELEMENT',
    'ELSE',
    'ELSEIF',
    'EMPTY',
    'ENABLE',
    'END',
    'EQUAL',
    'EQUALS',
    'ERROR',
    'ESCAPE',
    'ESCAPED',
    'EVAL',
    'EVALUATE',
    'EXCEEDED',
    'EXCEPT',
    'EXCEPTION',
    'EXCEPTIONS',
    'EXCLUSIVE',
    'EXEC',
    'EXECUTE',
    'EXISTS',
    'EXIT',
    'EXPLAIN',
    'EXPLODE',
    'EXPORT',
    'EXPRESSION',
    'EXTENDED',
    'EXTERNAL',
    'EXTRACT',
    'FAIL',
    'FALSE',
    'FAMILY',
    'FETCH',
    'FIELDS',
    'FILE',
    'FILTER',
    'FILTERING',
    'FINAL',
    'FINISH',
    'FIRST',
    'FIXED',
    'FLATTERN',
    'FLOAT',
    'FOR',
    'FORCE',
    'FOREIGN',
    'FORMAT',
    'FORWARD',
    'FOUND',
    'FREE',
    'FROM',
    'FULL',
    'FUNCTION',
    'FUNCTIONS',
    'GENERAL',
    'GENERATE',
    'GET',
    'GLOB',
    'GLOBAL',
    'GO',
    'GOTO',
    'GRANT',
    'GREATER',
    'GROUP',
    'GROUPING',
    'HANDLER',
    'HASH',
    'HAVE',
    'HAVING',
    'HEAP',
    'HIDDEN',
    'HOLD',
    'HOUR',
    'IDENTIFIED',
    'IDENTITY',
    'IF',
    'IGNORE',
    'IMMEDIATE',
    'IMPORT',
    'IN',
    'INCLUDING',
    'INCLUSIVE',
    'INCREMENT',
    'INCREMENTAL',
    'INDEX',
    'INDEXED',
    'INDEXES',
    'INDICATOR',
    'INFINITE',
    'INITIALLY',
    'INLINE',
    'INNER',
    'INNTER',
    'INOUT',
    'INPUT',
    'INSENSITIVE',
    'INSERT',
    'INSTEAD',
    'INT',
    'INTEGER',
    'INTERSECT',
    'INTERVAL',
    'INTO',
    'INVALIDATE',
    'IS',
    'ISOLATION',
    'ITEM',
    'ITEMS',
    'ITERATE',
    'JOIN',
    'KEY',
    'KEYS',
    'LAG',
    'LANGUAGE',
    'LARGE',
    'LAST',
    'LATERAL',
    'LEAD',
    'LEADING',
    'LEAVE',
    'LEFT',
    'LENGTH',
    'LESS',
    'LEVEL',
    'LIKE',
    'LIMIT',
    'LIMITED',
    'LINES',
    'LIST',
    'LOAD',
    'LOCAL',
    'LOCALTIME',
    'LOCALTIMESTAMP',
    'LOCATION',
    'LOCATOR',
    'LOCK',
    'LOCKS',
    'LOG',
    'LOGED',
    'LONG',
    'LOOP',
    'LOWER',
    'MAP',
    'MATCH',
    'MATERIALIZED',
    'MAX',
    'MAXLEN',
    'MEMBER',
    'MERGE',
    'METHOD',
    'METRICS',
    'MIN',
    'MINUS',
    'MINUTE',
    'MISSING',
    'MOD',
    'MODE',
    'MODIFIES',
    'MODIFY',
    'MODULE',
    'MONTH',
    'MULTI',
    'MULTISET',
    'NAME',
    'NAMES',
    'NATIONAL',
    'NATURAL',
    'NCHAR',
    'NCLOB',
    'NEW',
    'NEXT',
    'NO',
    'NONE',
    'NOT',
    'NULL',
    'NULLIF',
    'NUMBER',
    'NUMERIC',
    'OBJECT',
    'OF',
    'OFFLINE',
    'OFFSET',
    'OLD',
    'ON',
    'ONLINE',
    'ONLY',
    'OPAQUE',
    'OPEN',
    'OPERATOR',
    'OPTION',
    'OR',
    'ORDER',
    'ORDINALITY',
    'OTHER',
    'OTHERS',
    'OUT',
    'OUTER',
    'OUTPUT',
    'OVER',
    'OVERLAPS',
    'OVERRIDE',
    'OWNER',
    'PAD',
    'PARALLEL',
    'PARAMETER',
    'PARAMETERS',
    'PARTIAL',
    'PARTITION',
    'PARTITIONED',
    'PARTITIONS',
    'PATH',
    'PERCENT',
    'PERCENTILE',
    'PERMISSION',
    'PERMISSIONS',
    'PIPE',
    'PIPELINED',
    'PLAN',
    'POOL',
    'POSITION',
    'PRECISION',
    'PREPARE',
    'PRESERVE',
    'PRIMARY',
    'PRIOR',
    'PRIVATE',
    'PRIVILEGES',
    'PROCEDURE',
    'PROCESSED',
    'PROJECT',
    'PROJECTION',
    'PROPERTY',
    'PROVISIONING',
    'PUBLIC',
    'PUT',
    'QUERY',
    'QUIT',
    'QUORUM',
    'RAISE',
    'RANDOM',
    'RANGE',
    'RANK',
    'RAW',
    'READ',
    'READS',
    'REAL',
    'REBUILD',
    'RECORD',
    'RECURSIVE',
    'REDUCE',
    'REF',
    'REFERENCE',
    'REFERENCES',
    'REFERENCING',
    'REGEXP',
    'REGION',
    'REINDEX',
    'RELATIVE',
    'RELEASE',
    'REMAINDER',
    'RENAME',
    'REPEAT',
    'REPLACE',
    'REQUEST',
    'RESET',
    'RESIGNAL',
    'RESOURCE',
    'RESPONSE',
    'RESTORE',
    'RESTRICT',
    'RESULT',
    'RETURN',
    'RETURNING',
    'RETURNS',
    'REVERSE',
    'REVOKE',
    'RIGHT',
    'ROLE',
    'ROLES',
    'ROLLBACK',
    'ROLLUP',
    'ROUTINE',
    'ROW',
    'ROWS',
    'RULE',
    'RULES',
    'SAMPLE',
    'SATISFIES',
    'SAVE',
    'SAVEPOINT',
    'SCAN',
    'SCHEMA',
    'SCOPE',
    'SCROLL',
    'SEARCH',
    'SECOND',
    'SECTION',
    'SEGMENT',
    'SEGMENTS',
    'SELECT',
    'SELF',
    'SEMI',
    'SENSITIVE',
    'SEPARATE',
    'SEQUENCE',
    'SERIALIZABLE',
    'SESSION',
    'SET',
    'SETS',
    'SHARD',
    'SHARE',
    'SHARED',
    'SHORT',
    'SHOW',
    'SIGNAL',
    'SIMILAR',
    'SIZE',
    'SKEWED',
    'SMALLINT',
    'SNAPSHOT',
    'SOME',
    'SOURCE',
    'SPACE',
    'SPACES',
    'SPARSE',
    'SPECIFIC',
    'SPECIFICTYPE',
    'SPLIT',
    'SQL',
    'SQLCODE',
    'SQLERROR',
    'SQLEXCEPTION',
    'SQLSTATE',
    'SQLWARNING',
    'START',
    'STATE',
    'STATIC',
    'STATUS',
    'STORAGE',
    'STORE',
    'STORED',
    'STREAM',
    'STRING',
    'STRUCT',
    'STYLE',
    'SUB',
    'SUBMULTISET',
    'SUBPARTITION',
    'SUBSTRING',
    'SUBTYPE',
    'SUM',
    'SUPER',
    'SYMMETRIC',
    'SYNONYM',
    'SYSTEM',
    'TABLE',
    'TABLESAMPLE',
    'TEMP',
    'TEMPORARY',
    'TERMINATED',
    'TEXT',
    'THAN',
    'THEN',
    'THROUGHPUT',
    'TIME',
    'TIMESTAMP',
    'TIMEZONE',
    'TINYINT',
    'TO',
    'TOKEN',
    'TOTAL',
    'TOUCH',
    'TRAILING',
    'TRANSACTION',
    'TRANSFORM',
    'TRANSLATE',
    'TRANSLATION',
    'TREAT',
    'TRIGGER',
    'TRIM',
    'TRUE',
    'TRUNCATE',
    'TTL',
    'TUPLE',
    'TYPE',
    'UNDER',
    'UNDO',
    'UNION',
    'UNIQUE',
    'UNIT',
    'UNKNOWN',
    'UNLOGGED',
    'UNNEST',
    'UNPROCESSED',
    'UNSIGNED',
    'UNTIL',
    'UPDATE',
    'UPPER',
    'URL',
    'USAGE',
    'USE',
    'USER',
    'USERS',
    'USING',
    'UUID',
    'VACUUM',
    'VALUE',
    'VALUED',
    'VALUES',
    'VARCHAR',
    'VARIABLE',
    'VARIANCE',
    'VARINT',
    'VARYING',
    'VIEW',
    'VIEWS',
    'VIRTUAL',
    'VOID',
    'WAIT',
    'WHEN',
    'WHENEVER',
    'WHERE',
    'WHILE',
    'WINDOW',
    'WITH',
    'WITHIN',
    'WITHOUT',
    'WORK',
    'WRAPPED',
    'WRITE',
    'YEAR',
    'ZONE',
];

const RESERVED_KEYWORD_PREFIX = '#reserved_';

/**
 * Check if a key is a reserved keyword
 * @param key The key to check
 */
function isReservedKey(key: string) {
    return RESERVED_KEYWORDS.includes(key.toUpperCase());
}

/**
 * Convert a DynamoDB compatible object into a JavaScript object.
 * @param data The data to convert to a JavaScript object
 */
export function unmarshallReservedKeys(data: Record<string, AttributeValue>): Record<string, unknown> {
    return Object.entries(unmarshall(data)).reduce<Record<string, unknown>>((acc, [key, value]) => {
        const mappedKey = key.startsWith(RESERVED_KEYWORD_PREFIX) ? key.replace(RESERVED_KEYWORD_PREFIX, '') : key;

        acc[mappedKey] = value;

        return acc;
    }, {});
}

/**
 * Get the expression attribute names for a payload
 * @param payload The payload to get the expression attribute names for
 */
export function getExpressionAttributeNames(payload: Record<string, unknown>, prefix = '#'): Record<string, string> | undefined {
    const attributeNames = Object.entries(payload).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value === undefined) return acc;

        const mappedKey = isReservedKey(key) ? `${RESERVED_KEYWORD_PREFIX}${key}` : `${prefix}${key}`;

        acc[mappedKey] = key;

        return acc;
    }, {});

    if (Object.keys(attributeNames).length === 0) return undefined;

    return attributeNames;
}

/**
 * Get the expression attribute values for a payload
 * @param payload The payload to get the expression attribute values for
 */
export function getExpressionAttributeValues(payload: Record<string, unknown>, prefix = ':'): Record<string, AttributeValue> | undefined {
    const attributeValues = Object.entries(payload).reduce<Record<string, AttributeValue>>((acc, [key, value]) => {
        if (value === undefined) return acc;

        acc[`${prefix}${key}`] = marshall(value, { convertTopLevelContainer: true, removeUndefinedValues: true });

        return acc;
    }, {});

    if (Object.keys(attributeValues).length === 0) return undefined;

    return attributeValues;
}

/**
 * Get the update expression for a payload
 * @param payload The payload to get the update expression for
 */
export function getUpdateExpression(payload: Record<string, unknown>, keyPrefix = '#', valuePrefix = ':'): string | undefined {
    const expression = Object.entries(payload).reduce<string>((acc, [key, value], index) => {
        if (value === undefined) return acc;

        const mappedKey = isReservedKey(key) ? `${RESERVED_KEYWORD_PREFIX}${key}` : `${keyPrefix}${key}`;

        if (index === 0) {
            return `SET ${mappedKey} = ${valuePrefix}${key}`;
        }

        return `${acc}, ${mappedKey} = ${valuePrefix}${key}`;
    }, '');

    if (expression === '') return undefined;

    return expression;
}

/**
 * Get the condition expression for a payload
 * @param payload The payload to get the condition expression for
 */
export function getConditionExpression(payload: Record<string, unknown>, keyPrefix = '#', valuePrefix = ':'): string | undefined {
    const expression = Object.entries(payload).reduce<string>((acc, [key, value], index) => {
        if (value === undefined) return acc;

        const mappedKey = isReservedKey(key) ? `${RESERVED_KEYWORD_PREFIX}${key}` : `${keyPrefix}${key}`;

        if (index === 0) {
            return `${mappedKey} = ${valuePrefix}${key}`;
        }

        return `${acc} AND ${mappedKey} = ${valuePrefix}${key}`;
    }, '');

    if (expression === '') return undefined;

    return expression;
}

/**
 * Get the key condition expression
 * @param queryIndex The index to query
 * @param skMatch The match type for the sort key
 * @returns
 */
export function getKeyConditionExpression(
    queryIndex: DbIndex,
    skMatch: SkMatch,
    valuePrefix = ':',
): string {
    let keyConditionExpression;
    switch (skMatch) {
        case 'exact':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND ${queryIndex.sortKey} = ${valuePrefix}sk`;
            break;
        case 'begins_with':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND begins_with(${queryIndex.sortKey}, ${valuePrefix}sk)`;
            break;
        case 'greater_than':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND ${queryIndex.sortKey} > ${valuePrefix}sk`;
            break;
        case 'less_than':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND ${queryIndex.sortKey} < ${valuePrefix}sk`;
            break;
        case 'greater_than_or_equal':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND ${queryIndex.sortKey} >= ${valuePrefix}sk`;
            break;
        case 'less_than_or_equal':
            keyConditionExpression = `${queryIndex.partitionKey} = ${valuePrefix}pk AND ${queryIndex.sortKey} <= ${valuePrefix}sk`;
            break;
        default:
            throw new Error(`Invalid match type ${skMatch}`);
    }

    return keyConditionExpression;
}

/**
 * Generate a random UUID
*/
export function generateUUID(): string {
    return randomUUID();
}

/**
 * Removes undefined values from an object
 * @param obj The object to clean
 * @returns The cleaned object
 */
export function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

/**
 * Merges two resources
 * @param resources The resources to merge from left to right
 * @returns The merged resource
 */
export function mergeResources(...resources: Document[]): Document {
    return resources.reduce((acc, resource) => ({ ...acc, ...removeUndefined(resource) }), {});
}

/**
 * Replaces a field that matches the pattern "{fieldName}"" with the value from the resource
 * @param field The field to replace
 * @param resource A resource containing the values
 * @returns The field with the value replaced
 */
export function replaceFieldWithValue(
    field: string,
    resource: Document,
): string {
    const fieldRegex = new RegExp(/\{([^}]+)\}/, 'g');

    let match = fieldRegex.exec(field);
    let result = field;

    while (match !== null) {
        const [matchedPattern, requiredField] = match;

        const fieldValue = resource[requiredField];

        if (fieldValue) {
            result = result.replace(matchedPattern, String(fieldValue));
        }

        match = fieldRegex.exec(field);
    }

    return result;
};

/**
 * Removes index properties from a resource
 * @param resource The resource to remove the index properties from
 * @param indexConfig The index configuration
 * @returns The resource with the index properties removed
 */
export function removeIndexProperties(resource: Document, indexFieldsMap: IndexFieldsMap): Document {
    const forbiddenFields = Object.keys(indexFieldsMap);

    return Object.fromEntries(Object.entries(resource).filter(([key]) => forbiddenFields.includes(key)));
}

/**
 * Encodes the last evaluated key returned from a DynamoDB query
 * @param lastEvaluatedKey The decoded last evaluated key to encode
 */
export function encodeLastEvaluatedKey(lastEvaluatedKey: unknown): string | undefined {
    if (!lastEvaluatedKey) return undefined;

    return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
}

/**
 * Decodes the last evaluated key returned from a DynamoDB query
 * @param lastEvaluatedKey The encoded last evaluated key to decode
 */
export function decodeLastEvaluatedKey(lastEvaluatedKey: string): Record<string, AttributeValue> | undefined {
    try {
        return JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8'));
    } catch {
        return undefined;
    }
}
