type CompanySignals = {
    businessIntent?: string | null;
    technologyIntent?: string | null;
    developmentStacks: string[];
    certifications: string[];
    standards: string[];
    partnerships: string[];
    referenceArchitectures: string[];
    engineeringGuidelines: string[];
};

const pickTop = (values: string[], max = 3): string[] => values.slice(0, max);

const compactText = (value: string | null | undefined, maxLength = 220): string | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim().replace(/\s+/g, " ");
    if (trimmed.length <= maxLength) {
        return trimmed;
    }

    return `${trimmed.slice(0, maxLength - 1)}…`;
};

const summarizeCompanySignals = (company: CompanySignals) => ({
    businessIntent: compactText(company.businessIntent),
    technologyIntent: compactText(company.technologyIntent),
    stack: pickTop(company.developmentStacks, 5),
    certifications: pickTop(company.certifications),
    standards: pickTop(company.standards),
    partnerships: pickTop(company.partnerships),
    referenceArchitectures: pickTop(company.referenceArchitectures),
    engineeringGuidelines: pickTop(company.engineeringGuidelines),
});

export const summarizePersonaPromptContext = (input: {
    fullName: string;
    companyName: string;
    jobDescription?: string | null;
    personalitySummary?: string | null;
    personalPreferences?: string | null;
    pastExperiences?: string | null;
    communications: Array<{ type: string; content: string; occurredAt?: Date | null }>;
    companySignals: CompanySignals;
    proposalHistory: Array<{
        title: string;
        outcome: string;
        status: string;
        summary?: string | null;
        intentSignals?: string | null;
        technologyFit?: string | null;
        outcomeReason?: string | null;
    }>;
}) => {
    const outcomeCounts = input.proposalHistory.reduce(
        (acc, proposal) => {
            acc[proposal.outcome] = (acc[proposal.outcome] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const recentCommunications = input.communications.slice(0, 8);
    const communicationByType = recentCommunications.reduce(
        (acc, entry) => {
            acc[entry.type] = (acc[entry.type] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    return {
        persona: {
            fullName: input.fullName,
            companyName: input.companyName,
            jobDescription: compactText(input.jobDescription),
            personalitySummary: compactText(input.personalitySummary),
            personalPreferences: compactText(input.personalPreferences),
            pastExperiences: compactText(input.pastExperiences),
        },
        companySignals: summarizeCompanySignals(input.companySignals),
        communicationSummary: {
            total: input.communications.length,
            byType: communicationByType,
            recentHighlights: recentCommunications
                .map((entry) => compactText(entry.content, 140))
                .filter((entry): entry is string => !!entry),
        },
        proposalHistorySummary: {
            total: input.proposalHistory.length,
            outcomes: outcomeCounts,
            recent: input.proposalHistory.slice(0, 6).map((proposal) => ({
                title: proposal.title,
                outcome: proposal.outcome,
                status: proposal.status,
                summary: compactText(proposal.summary, 140),
                intentSignals: compactText(proposal.intentSignals, 120),
                technologyFit: compactText(proposal.technologyFit, 120),
                outcomeReason: compactText(proposal.outcomeReason, 120),
            })),
        },
    };
};

export const summarizeRfpPromptContext = (input: {
    proposal: {
        title: string;
        summary?: string | null;
        intentSignals?: string | null;
        technologyFit?: string | null;
        status: string;
        outcome: string;
        outcomeReason?: string | null;
    };
    company: CompanySignals & { name: string; industry?: string | null };
    stakeholders: Array<{
        fullName: string;
        role: string;
        influenceLevel: number;
        notes?: string | null;
        personalitySummary?: string | null;
        jobDescription?: string | null;
    }>;
    recentEvaluations: Array<{
        successSignals?: string | null;
        failureSignals?: string | null;
        successScore: number;
        failureRiskScore: number;
        recommendation?: string | null;
    }>;
}) => {
    return {
        proposal: {
            title: input.proposal.title,
            summary: compactText(input.proposal.summary),
            intentSignals: compactText(input.proposal.intentSignals),
            technologyFit: compactText(input.proposal.technologyFit),
            status: input.proposal.status,
            outcome: input.proposal.outcome,
            outcomeReason: compactText(input.proposal.outcomeReason),
        },
        company: {
            name: input.company.name,
            industry: compactText(input.company.industry),
            ...summarizeCompanySignals(input.company),
        },
        stakeholders: input.stakeholders.slice(0, 8).map((stakeholder) => ({
            fullName: stakeholder.fullName,
            role: stakeholder.role,
            influenceLevel: stakeholder.influenceLevel,
            notes: compactText(stakeholder.notes, 120),
            personalitySummary: compactText(stakeholder.personalitySummary, 120),
            jobDescription: compactText(stakeholder.jobDescription, 120),
        })),
        recentEvaluations: input.recentEvaluations.slice(0, 6).map((evaluation) => ({
            successScore: evaluation.successScore,
            failureRiskScore: evaluation.failureRiskScore,
            recommendation: compactText(evaluation.recommendation, 160),
            successSignals: compactText(evaluation.successSignals, 160),
            failureSignals: compactText(evaluation.failureSignals, 160),
        })),
    };
};

export const summarizeProposalDraftPromptContext = (input: {
    sourceProposal: {
        title: string;
        summary?: string | null;
        intentSignals?: string | null;
        technologyFit?: string | null;
    };
    company: CompanySignals & { name: string; industry?: string | null };
    stakeholders: Array<{
        fullName: string;
        role: string;
        influenceLevel: number;
        notes?: string | null;
    }>;
    evaluation: {
        recommendation: string;
        successSignals?: string | null;
        failureSignals?: string | null;
        successScore: number;
        failureRiskScore: number;
    };
}) => {
    return {
        sourceProposal: {
            title: input.sourceProposal.title,
            summary: compactText(input.sourceProposal.summary),
            intentSignals: compactText(input.sourceProposal.intentSignals),
            technologyFit: compactText(input.sourceProposal.technologyFit),
        },
        company: {
            name: input.company.name,
            industry: compactText(input.company.industry),
            ...summarizeCompanySignals(input.company),
        },
        stakeholders: input.stakeholders.slice(0, 8).map((stakeholder) => ({
            fullName: stakeholder.fullName,
            role: stakeholder.role,
            influenceLevel: stakeholder.influenceLevel,
            notes: compactText(stakeholder.notes, 120),
        })),
        evaluation: {
            recommendation: compactText(input.evaluation.recommendation, 180),
            successSignals: compactText(input.evaluation.successSignals, 160),
            failureSignals: compactText(input.evaluation.failureSignals, 160),
            successScore: input.evaluation.successScore,
            failureRiskScore: input.evaluation.failureRiskScore,
        },
    };
};
