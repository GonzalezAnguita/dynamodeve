export type DbIndex = {
    tableName: string;
    indexName: string | null;
    partitionKey: string;
    sortKey: string;
};

export type IndexFieldsMap = Record<string, string[]>;

export type DbResult<T> = {
    data: T;
};

export type PaginationConfig = {
    limit?: number;
    lastId?: string;
    sort?: 'asc' | 'desc';
};

export type PaginatedDbResult<T> = DbResult<T> & {
    lastId?: string;
};

export type Document = Record<string, unknown>;

export type WithTimestamps<T extends Document> = T & {
    createdAt: number;
    updatedAt: number;
};

export type TrxErrorPayloads = Record<string, Error>;

export type StringSafe = string | number | boolean | null;

export type SkMatch = 'exact' | 'begins_with' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal';

export type WithoutDefaults<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export type WithOptionals<T, D extends keyof T> = Omit<T, D> & Partial<Pick<T, D>>;

export type BuildIndexesConfig = {
    /** Generate a partial index value, useful for non exact queries */
    truncateAtFirstEmpty: boolean,
    /** Only build fields in this array */
    onlyFields?: string[],
};

export type QueryConfig = PaginationConfig & {
    skMatch: SkMatch,
};

export type QueryOneConfig = {
    /** The comparison method used for the SK */
    skMatch: SkMatch,
    /** The sort order of the results */
    sort?: 'asc' | 'desc',
};
