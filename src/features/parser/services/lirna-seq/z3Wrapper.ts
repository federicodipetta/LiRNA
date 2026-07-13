
import { Bool as b, init, Solver as ISolver } from "z3-solver";
let contextInstance: Awaited<ReturnType<typeof init>>["Context"] | null = null;
let initPromise: Promise<void> | null = null;

async function getContext() {
    if (contextInstance) return contextInstance;
    if (!initPromise) {
        initPromise = init().then(({ Context }) => {
            contextInstance = Context;
        });
    }
    await initPromise;
    return contextInstance!;
}

const ctx = (await getContext())("main");
export const { Solver, Int, Or, And, Bool } = ctx;
export const Z3 = ctx;
//export type Constraint = b;

export type Constraint = ManualConstraint;

export type ConstraintType = "true" | "false" | "eq" | "not" | "and" | "or";

class ManualConstraint {
    kind: ConstraintType;
    innter?: ManualConstraint; 
    left?: ManualConstraint;
    right?: ManualConstraint;
    label?: string;
    value?: number;


    constructor(kind: ConstraintType, innter?: ManualConstraint, left?: ManualConstraint, right?: ManualConstraint) {
        this.kind = kind;
        this.innter = innter;
        this.left = left;
        this.right = right;
    }

    public or(other: ManualConstraint): ManualConstraint {
        return new ManualConstraint("or", undefined, this, other);
    }

    public and(other: ManualConstraint): ManualConstraint {
        return new ManualConstraint("and", undefined, this, other);
    }

    public not(): ManualConstraint {
        return new ManualConstraint("not", this);
    }

    public subsitute(label: string, value: number): ManualConstraint {
        switch (this.kind) {
            case "true":  return this;
            case "false": return this;
            case "not": return this.innter!.subsitute(label, value).not();
            case "eq": {
                if (this.label === label) {
                    if (this.value === value) {
                        return TRUE;
                    } else {
                        return FALSE;
                    }
                } else {
                    return this;
                }
            }
            default: {
                throw new Error(`Substitution not implemented for constraint kind: ${this.kind}`);
            }
        }
    }

    public getVariables(): Set<string> {
        let vars = new Set<string>();
        this.getVariablesHelper(vars);
        return vars;
    }

    private getVariablesHelper(set: Set<string>) {
        switch (this.kind) {
            case "eq":
                set.add(this.label!);
            default: return;
        }
    }

}


export const TRUE = new ManualConstraint("true");
export const FALSE = new ManualConstraint("false");
// export const TRUE = Bool.val(true);
// export const FALSE = Bool.val(false);




// export function or(left: Constraint, right: Constraint): Constraint {
//     return Or(left, right);
// }

// export function and(left: Constraint, right: Constraint): Constraint {
//     return And(left, right);
// }

// export function eq(variable: string, value: number): Constraint {
//     return Int.const(variable).eq(value);
// }

// export function neq(variable: string, value: number): Constraint {
//     return Int.const(variable).neq(value);
// }

// /**
//  * constr \ [variable = value].
//  */
// export function substitute(constraint: Constraint, variable: string, value: number): Constraint {
//     const varAst = Int.const(variable);
//     return Z3.substitute(constraint, [varAst, Int.val(value)]) as Constraint;
// }

export function not(constraint: Constraint): Constraint {
    return new ManualConstraint("not", constraint as ManualConstraint);
    // return Z3.Not(constraint);
}
export function eq(variable: string, value: number): Constraint {
    return new ManualConstraint("eq", undefined, new ManualConstraint("true"), new ManualConstraint("true"));
    // return Int.const(variable).eq(value);
}


export interface CPSSolver {
    isSat(constraint: Constraint): Promise<boolean>;
    getSolutions(constraint: Constraint): Promise<Record<string, string>[]>;
    areEquivalent(a: Constraint, b: Constraint): Promise<boolean>;
}

export class ManualSolver implements CPSSolver {
    isSat(constraint: Constraint): Promise<boolean> {
    }
    getSolutions(constraint: Constraint): Promise<Record<string, string>[]> {
        throw new Error("Method not implemented.");
    }
    areEquivalent(a: Constraint, b: Constraint): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

}


export class Z3Wrapper {
    private maxDomain: number;
    private variables: Set<string>;

    constructor(maxDomain: number, variables: Set<string>) {
        this.maxDomain = maxDomain;
        this.variables = variables;
    }


    public initializeDomainConstraints(solver: ISolver) {
        this.variables.forEach(variable => {
            const varInt = Int.const(variable);
            solver.add(varInt.ge(0), varInt.le(this.maxDomain));
        });
    }

    public getTrueConstraint(): Constraint {
        return Int.val(1).eq(1);
    }

    public async getSolutions(constraint: Constraint): Promise<Record<string, string>[]> {
        const solution = [];
        let solver = new Solver();
        solver.add(constraint);
        this.initializeDomainConstraints(solver);
        try {
            while (await solver.check() === "sat") {
                if (this.variables.size === 0) {
                    solution.push({});
                    break; // No variables to constrain, exit the loop
                }
                const model = solver.model();
                const solutionEntry: Record<string, string> = {};
                this.variables.forEach(variable => {
                    solutionEntry[variable] = model.get(Int.const(variable)).toString();
                });
                solution.push(solutionEntry);

                const neqConstraints = Array.from(this.variables).map(variable =>
                    Int.const(variable).neq(model.get(Int.const(variable)))
                );
                solver.add(Or(...neqConstraints));
            }
        }
        catch (error) {
            console.error("Error while solving constraints:", error);
        }
        return solution;
    }

    public async areEquivalent(a: Constraint, b: Constraint): Promise<boolean> {
        const solver = new Solver();

        this.initializeDomainConstraints(solver);

        // (A && !B) || (B && !A)
        solver.add(
            Or(
                And(a, Z3.Not(b)),
                And(b, Z3.Not(a))
            )
        );

        return (await solver.check()) === "unsat";
    }

}