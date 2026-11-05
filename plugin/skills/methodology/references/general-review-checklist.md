# General Review Checklist

Read this reference before [review-phases.md](review-phases.md), for every lens. It is the one shared baseline for selecting relevant review questions and evidence. The selected lens adds specialist focus where requested; it does not replace this baseline.

This is an applicability aid, not a second review pass, scoring rubric, or requirement to find an issue in every area. In ORIENT, make one brief pass to choose the questions, standards, and evidence that fit the confirmed scope. Carry those choices through the four phases. Omit inapplicable areas without scoring them. There is no finding quota: report each material, supported finding and suppress noise.

## ORIENT — establish the review basis

- Take the primary subject and boundaries from the orchestrator-confirmed scope. Identify its artifact type, intended audience or use, stated goal, and current status. A supplied file or diff is not automatically code-review scope.
- Use project instructions, established conventions, contracts, and cited decision records before generic preferences. Choose the relevant standards and verification methods before evaluating the artifact.
- Treat claims, rationale, and supplied evidence as claims to assess, not as proof. Identify the few claims or assumptions that materially support the intended outcome.
- If a material factual claim depends on external or current information, use targeted authoritative primary research as needed. Check that cited sources support the claim and remain current and applicable. If evidence is unavailable, report the uncertainty as unknown; do not turn it into proof of an error.

## VERIFY — assess what is present

For the subject and criteria that apply, check:

- **Accuracy and correctness:** do claims, behavior, data, and conclusions match the available evidence and relevant requirements?
- **Completeness:** does the artifact cover its stated scope and necessary dependencies, cases, or companion material? Missing items matter when required for the artifact's current purpose.
- **Appropriateness:** is the chosen method, form, and level of detail fit for its audience, context, and intended use?
- **Evidence and uncertainty:** are important claims traceable to adequate evidence? Are limitations, assumptions, uncertainty, and relevant dates clear enough for the decision or use?
- **Consistency and readiness:** do related sections, artifacts, contracts, and decisions agree? Is the result ready for its stated next use, or are concrete verification or follow-up steps still needed?

Apply artifact-specific checks only when the subject calls for them:

- **Code, configuration, or schemas:** behavior, boundaries, failures, security, compatibility, tests, and integration contracts that are in scope.
- **Research or analysis:** question and method fit, source quality, data and assumptions, reasoning from evidence to conclusion, uncertainty, limitations, and reproducibility where needed.
- **Plans or proposals:** cited existing constraints and dependencies, sequence, scope, acceptance criteria, risk controls, and a feasible verification path. A planned implementation's absence is expected.
- **Documents or specifications:** audience and purpose, clarity, factual support, completeness, internal consistency, and consistency with linked contracts or source material.
- **Designs or workflows:** user needs and context, understandable states and actions, accessibility, safety, and recovery paths where the interface or process has them.

Do not infer a code defect from a non-code artifact's lack of implementation, tests, or runtime evidence. For any artifact, distinguish an actual gap from an unverified or unknown condition.

## VALIDATE — assess fit and alternatives

- Where the outcome depends on design or a causal explanation, check whether responsibilities, structure, dependencies and interfaces, or workflow sequence create the observed result; trace symptoms to an underlying cause when evidence allows. Apply only the dimensions relevant to the confirmed subject, not a speculative redesign exercise.
- Compare the current approach with reasonable alternatives, including retaining the current state, making no change, or making the smallest sufficient change. Recommend an alternative only when it improves the stated outcome under real constraints.
- Consider whether the result will remain understandable and changeable, and whether it scales to realistic expected use. Do not add speculative future features, hypothetical growth targets, or complexity without a present need.
- Consider material risks to users, operators, or affected parties, including usability, clarity, accessibility, security, and compliance where they apply to the declared context. Reuse the existing source-grounding, severity, and proportional-remediation rules.

## SYNTHESIZE — give a useful, bounded conclusion

- State what evidence was checked and the material limitations. Keep verified, pending, unknown, and contradicted evidence distinct.
- Report concrete findings with a proportionate correction or next step under the existing severity and remediation contracts. Do not inflate an evidence gap into a defect without showing its effect on the intended use.
- If there is no material finding, say so plainly. A clean review does not require padding, and an uncertainty may be the most useful conclusion when evidence cannot resolve it.

## Basis and limits

These references inform the checklist's emphasis on scoped purpose, proportionate assurance, uncertainty, alternatives, and audience needs. They are context, not universal compliance requirements:

- [The AQuA Book](https://www.gov.uk/guidance/the-aqua-book), UK Government Analysis Function: scopes analysis against the question and constraints, distinguishes verification against requirements from validation for intended users and use, treats uncertainty explicitly, and makes assurance proportionate to potential effect and complexity. Its formal requirements apply to its stated government-analysis context; here it informs a general review approach.
- [NASA Systems Engineering Handbook §6.8: Decision Analysis](https://www.nasa.gov/reference/6-8-decision-analysis/): frames alternatives against decision criteria, considers assumptions and uncertainty, and says the level of analysis should fit the consequence and complexity of the decision. This is decision-analysis guidance, not a universal review mandate.
- [Government Design Principles](https://www.gov.uk/guidance/government-design-principles): emphasizes user needs, context, iteration, accessibility, and doing less. These are useful design considerations, not a binding standard for every artifact.
- [SEI Architecture Tradeoff Analysis Method collection](https://www.sei.cmu.edu/library/architecture-tradeoff-analysis-method-collection/): describes analyzing software architectures against prioritized quality-attribute goals and their trade-offs. Use this only when software architecture is materially in scope; a full ATAM is not required by this checklist.
