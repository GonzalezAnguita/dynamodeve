export class ConditionCheckError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConditionCheckError';
    }
}

export class UniqueContraintError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UniqueContraintError';
    }
}
