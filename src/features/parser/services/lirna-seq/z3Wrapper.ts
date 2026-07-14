
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
    inner?: ManualConstraint; 
    left?: ManualConstraint;
    right?: ManualConstraint;
    label?: string;
    value?: number;


    constructor(kind: ConstraintType, innter?: ManualConstraint, left?: ManualConstraint, right?: ManualConstraint) {
        this.kind = kind;
        this.inner = innter;
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
            case "not": return this.inner!.subsitute(label, value).not();
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
            case "and": {
                return this.left!.subsitute(label, value).and(this.right!.subsitute(label, value));
            }
            case "or": {
                return this.left!.subsitute(label, value).or(this.right!.subsitute(label, value));
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
                set.add(this.label!); break;
            case "true":
            case "false":
                return;
            case "and":
            case "or": {
                this.right!.getVariablesHelper(set);
                this.left!.getVariablesHelper(set);
                return;
            }
            case "not": this.inner!.getVariablesHelper(set);
        }
    }

    public getRelevantValues(variable: string): Set<number> {
        let values = new Set<number>();
        this.getRelevantValuesHelper(variable, values);
        return values;
    }

    private getRelevantValuesHelper(variable: string, set: Set<number>) {
        switch (this.kind) {
            case "eq": {
                if (this.label === variable) {
                    set.add(this.value!);
                }
            }
            case "true":
            case "false":
                return;
            case "and":
            case "or": {
                this.right!.getRelevantValuesHelper(variable, set);
                this.left!.getRelevantValuesHelper(variable, set);
                return;
            }
            case "not": this.inner!.getRelevantValuesHelper(variable, set);
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

export function substiture(constraint: Constraint, variable: string, value: number): Constraint {
    return constraint.subsitute(variable, value);
}

export interface CPSSolver {
    isSat(constraint: Constraint): boolean
    getSolutions(constraint: Constraint): Record<string, string>[][];
    areEquivalent(a: Constraint, b: Constraint): boolean;
}

type DomainCoanidates = {
    values: number[];
    representativeValue?: number;
}
export class ManualSolver implements CPSSolver {
    
    maxDomain: number;
    variables?: Set<string>;
    constructor(maxDomain: number, variables?: Set<string>) {
        this.maxDomain = maxDomain;
        this.variables = variables;
    }

    public isSat(constraint: Constraint): boolean {
        var variables_relevantValues = new   Map<string, Set<number>>();
        const variables = constraint.getVariables();
        
        const sortedVariables = Array.from(variables).sort();

        var domain = this.getDomainCandidates(constraint, sortedVariables[0]);
        
        var iterator = domain.representativeValue !== undefined ? [...domain.values, domain.representativeValue] : domain.values;
        
        for (let value of iterator) {
            let newConstraint = constraint.subsitute(sortedVariables[0], value);
            if (this.isSat(newConstraint)) {
                return true;
            }
        }
        return false;
    }

    getDomainCandidates(constraint: Constraint, variable: string): DomainCoanidates {
        const relevantValues = constraint.getRelevantValues(variable);
        const representativeValues = new Array(this.maxDomain + 1).fill(0).map((_, i) => i).find(value => !relevantValues.has(value));
        return {
            values: Array.from(relevantValues),
            representativeValue: representativeValues
        }
    }
    
    public getSolutions(constraint: Constraint): Record<string, string>[][] {
        var solutions: Record<string, string>[][] = [];
        var assignments: Record<string, string>[] = [];
        var variables = this.variables || constraint.getVariables();
        this.collectSolutions(constraint, Array.from(variables), 0, assignments, solutions);
        return solutions;

    }

    collectSolutions(constraint: Constraint, variables: string[], index: number, assigments: Record<string, string>[], out: Record<string, string>[][]) {
        switch (constraint.kind) {
            case "false": return;
            case "true": {
                this.expandRemaining(variables, index, assigments, out);
                return;
            }
            default: {}
        }
        // unreachable state
        if (index >= variables.length) {
            return;
        }
        let label = variables[index];
        for (let value = 0; value <= this.maxDomain; value++) {
            let newConstraint = constraint.subsitute(label, value);
            assigments.push({ [label]: value.toString() });
            this.collectSolutions(newConstraint, variables, index + 1, assigments, out);
            assigments.pop();
        }
    }

    expandRemaining(variables: string[], index: number, assignments: Record<string, string>[], out: Record<string, string>[][]) {
        if (index >= variables.length) {
            out.push([...assignments]);
            return;
        }
        const variable = variables[index];
        for (let value = 0; value <= 1; value++) {
            assignments.push({ [variable]: value.toString() });
            this.expandRemaining(variables, index + 1, assignments, out);
            assignments.pop();
        }
    }
    
    public areEquivalent(a: Constraint, b: Constraint): boolean {
        return false;
    }

}


// export class Z3Wrapper {
//     private maxDomain: number;
//     private variables: Set<string>;

//     constructor(maxDomain: number, variables: Set<string>) {
//         this.maxDomain = maxDomain;
//         this.variables = variables;
//     }


//     public initializeDomainConstraints(solver: ISolver) {
//         this.variables.forEach(variable => {
//             const varInt = Int.const(variable);
//             solver.add(varInt.ge(0), varInt.le(this.maxDomain));
//         });
//     }

//     public getTrueConstraint(): Constraint {
//         return Int.val(1).eq(1);
//     }

//     public async getSolutions(constraint: Constraint): Promise<Record<string, string>[]> {
//         const solution = [];
//         let solver = new Solver();
//         solver.add(constraint);
//         this.initializeDomainConstraints(solver);
//         try {
//             while (await solver.check() === "sat") {
//                 if (this.variables.size === 0) {
//                     solution.push({});
//                     break; // No variables to constrain, exit the loop
//                 }
//                 const model = solver.model();
//                 const solutionEntry: Record<string, string> = {};
//                 this.variables.forEach(variable => {
//                     solutionEntry[variable] = model.get(Int.const(variable)).toString();
//                 });
//                 solution.push(solutionEntry);

//                 const neqConstraints = Array.from(this.variables).map(variable =>
//                     Int.const(variable).neq(model.get(Int.const(variable)))
//                 );
//                 solver.add(Or(...neqConstraints));
//             }
//         }
//         catch (error) {
//             console.error("Error while solving constraints:", error);
//         }
//         return solution;
//     }

//     public async areEquivalent(a: Constraint, b: Constraint): Promise<boolean> {
//         const solver = new Solver();

//         this.initializeDomainConstraints(solver);

//         // (A && !B) || (B && !A)
//         solver.add(
//             Or(
//                 And(a, Z3.Not(b)),
//                 And(b, Z3.Not(a))
//             )
//         );

//         return (await solver.check()) === "unsat";
//     }

// }