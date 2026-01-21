export const JUDGING_RUBRIC = {
  track1: {
    name: "High-Stakes Financial Decisions",
    description: "Solutions that help people navigate significant financial decisions with better information and clarity.",
    criteria: {
      problem: {
        weight: 1,
        description: "How significant and well-defined is the financial problem being addressed?",
        scoring: {
          1: "Problem is vague or trivial",
          2: "Problem exists but affects few people",
          3: "Clear problem affecting many people",
          4: "Significant problem with real financial impact",
          5: "Critical, widespread problem with major financial consequences"
        }
      },
      solution: {
        weight: 1,
        description: "How innovative and effective is the proposed solution?",
        scoring: {
          1: "Solution is unclear or doesn't address the problem",
          2: "Basic solution, similar to existing options",
          3: "Solid solution with some novel elements",
          4: "Innovative solution with clear advantages",
          5: "Breakthrough solution that could transform the space"
        }
      },
      execution: {
        weight: 1,
        description: "How well-implemented is the solution technically?",
        scoring: {
          1: "Minimal or non-functional implementation",
          2: "Basic prototype with significant gaps",
          3: "Working prototype demonstrating core features",
          4: "Polished implementation with good UX",
          5: "Production-ready quality with exceptional attention to detail"
        }
      }
    }
  },
  track2: {
    name: "Underserved Problems",
    description: "Solutions addressing overlooked challenges that impact underserved communities or use cases.",
    criteria: {
      problem: {
        weight: 1,
        description: "How underserved is this problem and how clearly is it defined?",
        scoring: {
          1: "Problem is not truly underserved",
          2: "Some existing solutions already address this",
          3: "Genuinely overlooked problem with clear definition",
          4: "Significant gap in current solutions for this community",
          5: "Critical underserved need with massive potential impact"
        }
      },
      solution: {
        weight: 1,
        description: "How well does the solution serve the target community?",
        scoring: {
          1: "Solution doesn't fit the community's needs",
          2: "Generic solution not tailored to the audience",
          3: "Solution shows understanding of the community",
          4: "Thoughtfully designed for the specific audience",
          5: "Deeply empathetic solution with community input"
        }
      },
      execution: {
        weight: 1,
        description: "How accessible and well-implemented is the solution?",
        scoring: {
          1: "Implementation creates new barriers",
          2: "Basic implementation with accessibility issues",
          3: "Functional with reasonable accessibility",
          4: "Well-implemented with good accessibility features",
          5: "Exceptional implementation prioritizing inclusivity"
        }
      }
    }
  }
};

export function getRubricPrompt(track: number): string {
  const trackConfig = track === 1 ? JUDGING_RUBRIC.track1 : JUDGING_RUBRIC.track2;

  return `
TRACK ${track}: ${trackConfig.name}
${trackConfig.description}

SCORING CRITERIA:

1. PROBLEM (1-5): ${trackConfig.criteria.problem.description}
   - 1: ${trackConfig.criteria.problem.scoring[1]}
   - 2: ${trackConfig.criteria.problem.scoring[2]}
   - 3: ${trackConfig.criteria.problem.scoring[3]}
   - 4: ${trackConfig.criteria.problem.scoring[4]}
   - 5: ${trackConfig.criteria.problem.scoring[5]}

2. SOLUTION (1-5): ${trackConfig.criteria.solution.description}
   - 1: ${trackConfig.criteria.solution.scoring[1]}
   - 2: ${trackConfig.criteria.solution.scoring[2]}
   - 3: ${trackConfig.criteria.solution.scoring[3]}
   - 4: ${trackConfig.criteria.solution.scoring[4]}
   - 5: ${trackConfig.criteria.solution.scoring[5]}

3. EXECUTION (1-5): ${trackConfig.criteria.execution.description}
   - 1: ${trackConfig.criteria.execution.scoring[1]}
   - 2: ${trackConfig.criteria.execution.scoring[2]}
   - 3: ${trackConfig.criteria.execution.scoring[3]}
   - 4: ${trackConfig.criteria.execution.scoring[4]}
   - 5: ${trackConfig.criteria.execution.scoring[5]}
`;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  repo: string;
  track: number;
  problem: number;
  solution: number;
  execution: number;
  total: number;
  linesOfCode: number;
  commentary: string;
  lastUpdated: string;
  previousRank?: number;
  currentRank?: number;
}
