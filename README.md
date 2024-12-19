# Dynamodel

An easier method to use AWS DynamoDB. It handles index generation but giving you more control to declare indexes and query patterns.

## Install
```bash
npm install dynamodeljs
```

## Setup

1. Declare your table configuration

```typescript
// db_config.ts

const TABLE_NAME = 'main';

export const PRIMARY_INDEX_CONFIG = {
    tableName: TABLE_NAME,
    indexName: null,
    partitionKey: 'PK',
    sortKey: 'SK',
} as const;

export const GSI1_CONFIG = {
    tableName: TABLE_NAME,
    indexName: 'GSI1',
    partitionKey: 'GSI1PK',
    sortKey: 'GSI1SK',
} as const;

export const GSI2_CONFIG = {
    tableName: TABLE_NAME,
    indexName: 'GSI2',
    partitionKey: 'GSI2PK',
    sortKey: 'GSI2SK',
} as const;

```

2. Create a model using the configuration

```typescript
// user.ts

type User = {
    givenName: string;
    lastName: string;
    email: string;
    nationalId: string;
}
```

Declare your model entity name
```typescript
const ENTITY_NAME = 'User';
```

Declare your model index configuration, for this step you can use curly braces as template fields for the lib to generate your indexes
```typescript
// user.ts

const INDEX_FIELDS_MAP: IndexFieldsMap = {
    [PRIMARY_INDEX_CONFIG.partitionKey]: [ENTITY_NAME, '{id}'],
    [PRIMARY_INDEX_CONFIG.sortKey]: [ENTITY_NAME],
    [GSI1_CONFIG.partitionKey]: [ENTITY_NAME],
    [GSI1_CONFIG.sortKey]: [ENTITY_NAME, '{email}'],
    [GSI2_CONFIG.partitionKey]: [ENTITY_NAME],
    [GSI2_CONFIG.sortKey]: [ENTITY_NAME, '{nationalId}'],
};
```

After index generation the above will generate indexes like
```typescript
PK: User#937c1e16-cb48-454d-825b-7398ab990d91
SK: User

GSI1PK: User
GSI1SK: User#some@email.com

GSI2PK: User
GSI2SK: User#13812718
```

The next step is to declare your wrapper model
```typescript
// user.ts

export class Handler extends DbModel<Entity> {
    constructor(pkPrefix: string) {
        super(pkPrefix, ENTITY_NAME, PRIMARY_INDEX_CONFIG, INDEX_FIELDS_MAP);
    }

    // Primary Access patterns

    public async findOneById(id: string): Promise<Entity | null> {
        return this.queryOne({ id }, PRIMARY_INDEX_CONFIG, { skMatch: 'exact' });
    }

    // GSI1 Access patterns

    public async find(config: PaginationConfig = {}): Promise<PaginatedDbResult<Entity[]>> {
        return await this.query({}, GSI1_CONFIG, { ...config, skMatch: 'begins_with' });
    }

    public async findOneByEmail(email: string): Promise<Entity | null> {
        return this.queryOne({ email }, GSI1_CONFIG, { skMatch: 'exact' });
    }

    // GSI2 Access patterns

    public async findOneByNationalId(nationalId: string): Promise<Entity | null> {
        return this.queryOne({ nationalId }, GSI2_CONFIG, { skMatch: 'exact' });
    }

    // CRUD operations

    public async createOne(input: WithoutDefaults<Entity>): Promise<Entity> {
        const { id } = this.trxInsertOne(input);

        this.trxInsertUniqueConstraint([input.email]);

        if (input.nationalId) {
            this.trxInsertUniqueConstraint([input.nationalId]);
        }

        await this.trxExecute();

        const createdResource = await this.findOneById(id);
        if (createdResource === null) {
            throw new Error('Failed to find resource after create');
        }

        return createdResource;
    }

    public async updateOne(id: string, input: Partial<WithoutDefaults<Entity>>, filter: Partial<Entity> = {}): Promise<Entity | null> {
        const resource = await this.findOneById(id);
        if (resource === null) return null;

        this.trxUpdateOne(input, resource, filter);

        if (input.email && input.email !== resource.email) {
            this.trxRemoveUniqueConstraint([resource.email]);
            this.trxInsertUniqueConstraint([input.email]);
        }

        if (input.nationalId && input.nationalId !== resource.nationalId) {
            if (resource.nationalId) {
                this.trxRemoveUniqueConstraint([resource.nationalId]);
            }
            this.trxInsertUniqueConstraint([input.nationalId]);
        }

        await this.trxExecute();

        return this.findOneById(id);
    }

    public async deleteOne(id: string, filter: Partial<Entity> = {}): Promise<Entity | null> {
        const resource = await this.findOneById(id);
        if (resource === null) return null;

        this.trxDeleteOne(resource, filter);

        this.trxRemoveUniqueConstraint([resource.email]);

        if (resource.nationalId !== undefined) {
            this.trxRemoveUniqueConstraint([resource.nationalId]);
        }

        await this.trxExecute();

        return resource;
    }
}
```