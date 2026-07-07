
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
export type Constraint = b;



export function or(left: Constraint, right: Constraint): Constraint {
    return Or(left, right);
}

export function and(left: Constraint, right: Constraint): Constraint {
    return And(left, right);
}

export function eq(variable: string, value: number): Constraint {
    return Int.const(variable).eq(value);
}

export function neq(variable: string, value: number): Constraint {
    return Int.const(variable).neq(value);
}

/**
 * constr \ [variable = value].
 */
export function substitute(constraint: Constraint, variable: string, value: number): Constraint {
    const varAst = Int.const(variable);
    return Z3.substitute(constraint, [varAst, Int.val(value)]) as Constraint;
}

export const TRUE = Bool.val(true);
export const FALSE = Bool.val(false);

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