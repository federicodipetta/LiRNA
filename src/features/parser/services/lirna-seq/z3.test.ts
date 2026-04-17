import {it, describe, expect} from "vitest";

import { Z3Wrapper } from "./z3Wrapper";

import { init } from "z3-solver";

import { eq, or, and } from "./z3Wrapper";

const { Context } = await init();

const { Solver, Int, Or, And } = Context("main");


describe("Z3 basic operations", () => {
  it("can create and solve a simple constraint", async () => {
    
    const l = Int.const("l");
    const a = Int.const("a");

    const solver = new Solver();

    const domain_max = 10;
    solver.add(l.ge(0), l.le(domain_max));
    solver.add(a.ge(0), a.le(domain_max));
    solver.add(
        Or(
            And(l.eq(1), a.eq(2)),
            And(l.eq(3), a.eq(4))
        )
    );
    const solution = [];
    while (await solver.check() === "sat") {
        const model = solver.model();
        solution.push({ l: model.get(l).toString(), a: model.get(a).toString() });
        solver.add(Or(l.neq(model.get(l)), a.neq(model.get(a))));
    }
    solution.sort((x, y) => Number(x.l) - Number(y.l));
    const mappedSolution = solution.map((x) => ({
      a: x.a,
      l: x.l,
    }));

    expect(mappedSolution).toEqual([
      { l: "1", a: "2" },
      { l: "3", a: "4" },
    ]);

  });


});

describe("Z3Wrapper integration", () => {
    it("can create and solve constraints using the wrapper", async () => {
        const wrapper = new Z3Wrapper(10, new Set(["l", "a"]));
        const constraint1 = eq("l", 1);
        const constraint2 = eq("a", 2);
        const constraint3 = eq("l", 3);
        const constraint4 = eq("a", 4);
        
        const combinedConstraint = or(
            and(constraint1, constraint2),
            and(constraint3, constraint4)
        )
        const solutions = await wrapper.getSolutions(combinedConstraint);
        solutions.sort((x, y) => Number(x.l) - Number(y.l));
        const mappedSolutions = solutions.map((x) => ({
          a: x.a,
          l: x.l,
        }));
        expect(mappedSolutions).toEqual([
            { l: "1", a: "2" },
            { l: "3", a: "4" },
        ]);
    });

    it ("can create and solve constraint using just constraint", async () => {
        const wrapper = new Z3Wrapper(10, new Set(["l", "a"]));
        const constraint = eq("l", 1).and(eq("a", 2)).or(eq("l", 3).and(eq("a", 4)));

        const solutions = await wrapper.getSolutions(constraint);

        solutions.sort((x, y) => Number(x.l) - Number(y.l));
        const mappedSolutions = solutions.map((x) => ({
          a: x.a,
          l: x.l,
        }));
        expect(mappedSolutions).toEqual([
            { l: "1", a: "2" },
            { l: "3", a: "4" },
        ]);
    });
});
