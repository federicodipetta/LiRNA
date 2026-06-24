
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

export const { Solver, Int, Or, And, Bool } = (await getContext())("main");

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

export const TRUE = Bool.val(true);
export const FALSE = Bool.val(false);

export class Z3Wrapper {
    private solver: ISolver;
    private maxDomain: number;
    private variables: Set<string>;

    constructor(maxDomain: number, variables: Set<string>) {
        this.solver = new Solver();
        this.maxDomain = maxDomain;
        this.variables = variables;
    }


    private initializeDomainConstraints(    ) {
        this.variables.forEach(variable => {
            const varInt = Int.const(variable);
            this.solver.add(varInt.ge(0), varInt.le(this.maxDomain));
        });
    }

    public getTrueConstraint(): Constraint {
        return Int.val(1).eq(1);
    }

    public async getSolutions(constraint: Constraint): Promise<Record<string, string>[]> {
        const solution = [];
        this.initializeDomainConstraints();
        this.solver.add(constraint);
        while (await this.solver.check() === "sat") {

            const model = this.solver.model();
            const solutionEntry: Record<string, string> = {};
            this.variables.forEach(variable => {
                solutionEntry[variable] = model.get(Int.const(variable)).toString();
            });
            solution.push(solutionEntry);
            const neqConstraints = Array.from(this.variables).map(variable => 
                Int.const(variable).neq(model.get(Int.const(variable)))
            );
            this.solver.add(Or(...neqConstraints));
        }
        this.solver.reset(); 
        return solution;
    }
    
}