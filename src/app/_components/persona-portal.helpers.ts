type IdLabelOption = {
    value: number;
    label: string;
};

type CompanyLike = {
    id: number;
    name: string;
};

type PersonaLike = {
    id: number;
    fullName: string;
    company: {
        name: string;
    };
};

type ProposalLike = {
    id: number;
    title: string;
    company: {
        name: string;
    };
};

export const csvFromArray = (values: string[]) => values.join(", ");

export const shouldCloseEditor = (isDirty: boolean, warningMessage: string) => {
    if (!isDirty) {
        return true;
    }

    return window.confirm(warningMessage);
};

export const recommendationPreview = (value: string | null) => {
    if (!value) {
        return "-";
    }

    return value.slice(0, 80) + (value.length > 80 ? "..." : "");
};

export const mapCompanyOptions = (companies: CompanyLike[]): IdLabelOption[] => {
    return companies.map((company) => ({
        value: company.id,
        label: company.name,
    }));
};

export const mapPersonaOptions = (personas: PersonaLike[]): IdLabelOption[] => {
    return personas.map((persona) => ({
        value: persona.id,
        label: `${persona.fullName} (${persona.company.name})`,
    }));
};

export const mapProposalOptions = (proposals: ProposalLike[]): IdLabelOption[] => {
    return proposals.map((proposal) => ({
        value: proposal.id,
        label: `${proposal.title} (${proposal.company.name})`,
    }));
};
