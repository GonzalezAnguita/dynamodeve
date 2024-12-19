# Dynamoose

Welcome to the future of DynamoDB

To start creating models you need to create a `database` directory

```bash
mkdir database && cd database
```

## 1. Create the database configuration file
First create the file
```bash
# ./database

touch db_config.ts
```

Here you will need to declare the primary index and global secondary indexes

```typescript
// ./database/config.ts

const TABLE_NAME = 'main';

export const PRIMARY_INDEX_CONFIG = {
    tableName: TABLE_NAME,
    indexName: null,  // <---------- Read the "note" below
    partitionKey: 'PK',
    sortKey: 'SK',
} as const;

export const GSI1_CONFIG = {
    tableName: TABLE_NAME,
    indexName: 'GSI1',
    partitionKey: 'GSI1PK',
    sortKey: 'GSI1SK',
} as const;

...

```

`Note`: the primary index MUST have `indexName: null`

## 2. Create the model folder
We will use as an example a model for a `User`

```bash
# ./database

mkdir user && cd user
```

## 3. Create a model JSON Schema

First create the file
```bash
# ./database/users

touch schema.ts
```

and then paste your schema
```typescript
// ./database/users/schema.ts

export const USER_SCHEMA = {
    type: 'object',
    properties: {
        id: {
            type: 'string',
        },
        givenName: {
            type: 'string',
        },
        familyName: {
            type: 'string',
        },
        email: {
            type: 'string',
        },
        createdAt: {
            type: 'number',
        },
        updatedAt: {
            type: 'number',
        },
    },
    required: ['id', 'givenName', 'familyName', 'email', 'createdAt', 'updatedAt'],
    additionalProperties: false,
} as const;  // <---------- Read the "note" below
```

`Note`: in order for the type to work, mark your schema `as const`  
`Note 2`: the fields "id", "createdAt" and "updatedAt" MUST always be on your schema

## 4. Create the model types

First create the file
```bash
# ./database/users

touch types.ts
```

and then paste the following types

```typescript
// ./database/users/types.ts

import { FromSchema } from '@utils';
import { USER_SCHEMA } from './schema';

export type User = FromSchema<typeof USER_SCHEMA>;

```

## 5. Create the model handler

First create the file
```bash
# ./database/users

touch handler.ts
```

This is the most complicated/database oriented part, first you must declare your index structure. To do that you can use hardcoded strings or placeholders `{someField}` where `someField` is a property of the User schema.

```typescript
// ./database/users/handler.ts

import { IndexFieldsMap } from '@utils';
import { PRIMARY_INDEX_CONFIG } from '../../config';

const ENTITY = 'User';

const WRITE_INDEX_MAP: IndexFieldsMap = {
    [PRIMARY_INDEX_CONFIG.partitionKey]: [ENTITY, '{id}'],
    [PRIMARY_INDEX_CONFIG.sortKey]: [ENTITY],
};

...
```

Then create the query indexes (the GSI used by your model)

```typescript
// ./database/users/handler.ts

import { IndexFieldsMap } from '@utils';
import { GSI1_CONFIG } from '../../config';

const ENTITY = 'User';

...

const QUERY_INDEX_MAP: IndexFieldsMap = {
    [GSI1_CONFIG.partitionKey]: [ENTITY],
    [GSI1_CONFIG.sortKey]: [ENTITY, '{email}'],
};
```

Now you will need to declare your model handler class
```typescript
// ./database/users/handler.ts

import { DbModel } from '@utils';

import { USER_SCHEMA } from './schema';
import { User } from './types';

export class UserHandler extends DbModel<User> {
    constructor(
        entity = 'User',
        schema = USER_SCHEMA,
        writeIndex = PRIMARY_INDEX_CONFIG,
        writeIndexMap = WRITE_INDEX_MAP,
        queryIndexMap = QUERY_INDEX_MAP,
    ) {
        super(entity, schema, writeIndex, writeIndexMap, queryIndexMap);
    }

    ...
}
```

The above will configure the model to have the following keys
```
PK: 'User#some-user-id'
SK: 'User#Metadata'
GSI1PK: 'User'
GSI1SK: 'User#some-user@email.com'
```

With that you are ready to implement the CRUD methods!

## 6. Read methods

## 6.1 Find all users

To find all users, we will use the GSI1

```typescript
// ./database/users/handler.ts

import { PaginationConfig } from '@utils';

export class UserHandler extends DbModel<User> {

    ...

    public async find(config: PaginationConfig = {}): Promise<PaginatedDbResult<User[]>> {
        return this.query({}, GSI1_CONFIG, { ...config, skMatch: 'begins_with' });
    }

    ...
}
```

As you can see here, we are not passing any filters, we are using the `GSI1_CONFIG` and a `skMarch: begins_with` the logic behind this is that the following query will be performed

```typescript
GSI1PK = 'User' AND begins_with('User', GSI1SK)
```

## 6.2 Find user by id

To find a user by it's id, we will use `queryOne`

```typescript
// ./database/users/handler.ts

export class UserHandler extends DbModel<User> {

    ...

    public async findOneById(id: string): Promise<User | null> {
        return this.queryOne({ id }, PRIMARY_INDEX_CONFIG, { skMatch: 'exact' });
    }

    ...
}
```

Here you can see that we are filtering by ID, and using the `PRIMARY_INDEX_CONFIG` to generate the required keys. Passing `skMatch: exact` will make this query match the sort key completely. The following query will be performed

```typescript
PK = 'User#<provided-id>' AND SK = 'User#Metadata'
```

## 6.3 Find user by email

So, we want to identify our user by it's email, let's create an access pattern for that

```typescript
// ./database/users/handler.ts

export class UserHandler extends DbModel<User> {

    ...

    public async findOneByEmail(email: string): Promise<User | null> {
        return this.queryOne({ email }, GSI1_CONFIG, { skMatch: 'exact' });
    }

    ...
}
```
Here you can see that we are filtering by email, and using the `GSI1_CONFIG` to generate the required keys. Passing `skMatch: exact` will make this query match the sort key completely. The following query will be performed

```typescript
GSI1PK = 'User' AND GSI1SK = 'User#<provided-email>'
```

# 7. Write methods

## 7.1 Create a user

So we want to create a user, for that we will add a `createOne` method

```typescript
// ./database/users/handler.ts

import { WithoutDefaults } from '@utils';
import { User } from './types';

export class UserHandler extends DbModel<User> {

    ...

    public async createOne(
        input: WithoutDefaults<User>,
    ): Promise<User> {
        const id = this.trxInsertOne(input, new Error('Failed to insert resource');
        
        await this.trxExecute();

        const createdResource = await this.findOneById(id);
        if (createdResource === null) {
            throw new Error('Failed to find resource after create');
        }

        return createdResource;
    }

    ...
}
```

Wait, what if I want users to have unique emails?

```typescript
// ./database/users/handler.ts

import { WithoutDefaults } from '@utils';
import { User } from './types';

export class UserHandler extends DbModel<User> {

    ...

    public async createOne(
        input: WithoutDefaults<User>,
    ): Promise<User> {
        ...

        // We insert a constraint transaction
        this.trxInsertUniqueConstraint([input.email]);
        
        await this.trxExecute();

        ...
    }

    ...
}
```

By using transactions we can rollback the user creation if the constraint throws an error

## 7.2 Update a user

Users have free will and might want to change their email, let's add an `updateOne` method

```typescript
// ./database/users/handler.ts

import { WithoutDefaults } from '@utils';
import { User } from './types';

export class UserHandler extends DbModel<User> {

    ...

    public async updateOne(
        id: string,
        input: Partial<WithoutDefaults<User>>,
    ): Promise<User | null> {
        const resource = await this.findOneById(id);
        if (resource === null) return null;
    
        this.trxUpdateOne(input, resource);

        // Remove old constraint
        if (input.email !== resource.email) {
            this.trxRemoveUniqueConstraint([resource.email]);
        }

        // Create new constraint
        this.trxInsertUniqueConstraint([resource.email]);

        await this.trxExecute();

        return this.findOneById(id);
    }

    ...
}
```

## 7.3 Deleting a user

Life happens and your user wants to be deleted, what can we do?


```typescript
// ./database/users/handler.ts

import { WithoutDefaults } from '@utils';
import { User } from './types';

export class UserHandler extends DbModel<User> {

    ...

    public async deleteOne(
        id: string,
    ): Promise<User | null> {
        const resource = await this.findOneById(id);
        if (resource === null) return null;

        this.trxDeleteOne(resource, new Error('Failed to delete resource');
        
        // Don't forget to remove your constraints
        this.trxRemoveUniqueConstraint([resource.email], new Error(`Failed to delete unique constraint for ${resource.email}`);

        await this.trxExecute();

        return resource;
    }

    ...
}
```