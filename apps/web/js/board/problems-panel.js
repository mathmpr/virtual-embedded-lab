export function createProblemsPanel({ problemList }) {
  function renderProblems(problems) {
    problemList.innerHTML = problems.map((problem) => `<li>${problem}</li>`).join('');
  }

  return {
    renderProblems
  };
}
