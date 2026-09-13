import {
  type AcademicCourseOffering,
  validateAcademicOffering,
} from "./academic-section-linkage.ts";
import {
  type AcademicMemoryScope,
  type AcademicOfferingObservation,
  type AcademicSourceAuthority,
  type AcademicSourceKind,
  type AcademicTermRef,
  validateAcademicObservation,
} from "./academic-memory.ts";

export type AcademicIngestionChannel =
  | "api"
  | "portal"
  | "pdf"
  | "image"
  | "csv"
  | "xlsx"
  | "manual";

export type AcademicExtractionMethod = "structured" | "ocr" | "manual";

export type AcademicInstitutionSourceRegistration = {
  sourceId: string;
  kind: AcademicSourceKind;
  authority: Extract<AcademicSourceAuthority, "official" | "reviewed">;
  channels: readonly AcademicIngestionChannel[];
  allowedHosts?: readonly string[];
  active?: boolean;
};

export type AcademicInstitutionRegistration = {
  institutionId: string;
  names: readonly string[];
  officialDomains: readonly string[];
  sources: readonly AcademicInstitutionSourceRegistration[];
};

export type AcademicInstitutionRegistry = readonly AcademicInstitutionRegistration[];

export type AcademicIngestionSource = {
  sourceId: string;
  channel: AcademicIngestionChannel;
  sourceUri?: string;
  observedAt: string;
};

export type AcademicIngestionExtraction = {
  method: AcademicExtractionMethod;
  confidence?: number;
};

export type AcademicIngestionUnresolvedContext =
  | "institution"
  | "term"
  | "course_identity"
  | "region"
  | "campus"
  | "college"
  | "program"
  | "plan"
  | "track"
  | "level";

export type AcademicIngestionCandidate = {
  candidateId: string;
  institutionId: string;
  courseIdentityId?: string;
  courseCode?: string;
  courseName?: string;
  term?: AcademicTermRef;
  context?: Omit<AcademicMemoryScope, "institutionId" | "courseIdentityId">;
  offering?: AcademicCourseOffering;
  source: AcademicIngestionSource;
  extraction: AcademicIngestionExtraction;
  unresolvedContext?: readonly AcademicIngestionUnresolvedContext[];
};

export type AcademicInstitutionRegistryIssueCode =
  | "missing_institution_id"
  | "missing_institution_name"
  | "duplicate_institution_id"
  | "duplicate_source_id"
  | "invalid_official_domain"
  | "official_source_without_host"
  | "source_host_outside_institution_domain";

export type AcademicInstitutionRegistryIssue = {
  code: AcademicInstitutionRegistryIssueCode;
  detail: string;
};

export type AcademicIngestionReasonCode =
  | "registry_invalid"
  | "missing_candidate_id"
  | "missing_institution"
  | "unknown_institution"
  | "source_institution_mismatch"
  | "source_disabled"
  | "source_channel_mismatch"
  | "source_uri_required"
  | "source_uri_invalid"
  | "source_host_mismatch"
  | "unregistered_source"
  | "missing_term"
  | "missing_course_identity"
  | "missing_course_code"
  | "missing_course_name"
  | "missing_offering"
  | "invalid_offering"
  | "context_mismatch"
  | "unresolved_context"
  | "invalid_extraction_confidence"
  | "invalid_observed_at"
  | "ocr_requires_review"
  | "manual_requires_review"
  | "untrusted_source_requires_review";

export type AcademicIngestionReason = {
  code: AcademicIngestionReasonCode;
  detail: string;
};

export type AcademicIngestionDecision = {
  status: "accept" | "review" | "reject";
  candidateId: string;
  institutionId: string;
  sourceAuthority: AcademicSourceAuthority | null;
  sourceKind: AcademicSourceKind | null;
  reasons: readonly AcademicIngestionReason[];
};

type RegisteredSource = {
  institution: AcademicInstitutionRegistration;
  source: AcademicInstitutionSourceRegistration;
};

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

function clean(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function validHost(value: string) {
  const host = normalizeHost(value);
  if (!host || host.includes("/") || host.includes(":") || host.includes(" ")) return false;
  return host.split(".").every(label => /^[a-z0-9-]+$/.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

function hostMatchesDomain(host: string, domain: string) {
  const normalizedHost = normalizeHost(host);
  const normalizedDomain = normalizeHost(domain);
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function parsedHttpsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function sourceIndex(registry: AcademicInstitutionRegistry) {
  const map = new Map<string, RegisteredSource>();
  for (const institution of registry) {
    for (const source of institution.sources) {
      if (!map.has(source.sourceId)) map.set(source.sourceId, { institution, source });
    }
  }
  return map;
}

export function validateAcademicInstitutionRegistry(
  registry: AcademicInstitutionRegistry,
): AcademicInstitutionRegistryIssue[] {
  const issues: AcademicInstitutionRegistryIssue[] = [];
  const institutionIds = new Set<string>();
  const sourceIds = new Set<string>();

  for (const institution of registry) {
    const institutionId = clean(institution.institutionId);
    if (!institutionId || !IDENTIFIER_PATTERN.test(institutionId)) {
      issues.push({ code: "missing_institution_id", detail: institution.institutionId || "institution" });
    } else if (institutionIds.has(institutionId)) {
      issues.push({ code: "duplicate_institution_id", detail: institutionId });
    } else {
      institutionIds.add(institutionId);
    }

    if (!institution.names.some(name => Boolean(clean(name)))) {
      issues.push({ code: "missing_institution_name", detail: institution.institutionId || "institution" });
    }

    for (const domain of institution.officialDomains) {
      if (!validHost(domain)) {
        issues.push({ code: "invalid_official_domain", detail: `${institution.institutionId}:${domain}` });
      }
    }

    for (const source of institution.sources) {
      if (sourceIds.has(source.sourceId)) {
        issues.push({ code: "duplicate_source_id", detail: source.sourceId });
      }
      sourceIds.add(source.sourceId);

      if (source.authority === "official" && (!source.allowedHosts || source.allowedHosts.length === 0)) {
        issues.push({ code: "official_source_without_host", detail: `${institution.institutionId}:${source.sourceId}` });
      }
      for (const host of source.allowedHosts || []) {
        if (!validHost(host)) {
          issues.push({ code: "invalid_official_domain", detail: `${institution.institutionId}:${source.sourceId}:${host}` });
          continue;
        }
        if (source.authority === "official" && !institution.officialDomains.some(domain => hostMatchesDomain(host, domain))) {
          issues.push({
            code: "source_host_outside_institution_domain",
            detail: `${institution.institutionId}:${source.sourceId}:${host}`,
          });
        }
      }
    }
  }

  return issues;
}

function candidateScope(candidate: AcademicIngestionCandidate): AcademicMemoryScope | null {
  const institutionId = clean(candidate.institutionId);
  const courseIdentityId = clean(candidate.courseIdentityId);
  if (!institutionId || !courseIdentityId) return null;
  return {
    institutionId,
    courseIdentityId,
    ...(candidate.context || {}),
  };
}

function contextMismatch(candidate: AcademicIngestionCandidate) {
  if (!candidate.offering || !candidate.term) return [] as string[];
  const mismatches: string[] = [];
  const offering = candidate.offering;
  const context = offering.context;
  if (offering.courseCode !== candidate.courseCode) mismatches.push("courseCode");
  if (offering.courseName !== candidate.courseName) mismatches.push("courseName");
  if (context?.termId && context.termId !== candidate.term.termId) mismatches.push("termId");
  if (context?.regionId && context.regionId !== candidate.context?.regionId) mismatches.push("regionId");
  if (context?.campusId && context.campusId !== candidate.context?.campusId) mismatches.push("campusId");
  if (context?.programId && context.programId !== candidate.context?.programId) mismatches.push("programId");
  if (context?.planId && context.planId !== candidate.context?.planId) mismatches.push("planId");
  return mismatches;
}

function provisionalObservation(
  candidate: AcademicIngestionCandidate,
  registered: RegisteredSource,
): AcademicOfferingObservation | null {
  const scope = candidateScope(candidate);
  if (!scope || !candidate.term || !candidate.offering || !candidate.courseCode || !candidate.courseName) return null;
  return {
    recordKind: "observation",
    observationId: `ingest:${candidate.candidateId}`,
    scope,
    term: candidate.term,
    courseCodeAtObservation: candidate.courseCode,
    courseNameAtObservation: candidate.courseName,
    offering: candidate.offering,
    evidence: {
      sourceId: registered.source.sourceId,
      kind: registered.source.kind,
      authority: registered.source.authority,
      observedAt: candidate.source.observedAt,
      confidence: candidate.extraction.confidence,
    },
  };
}

export function evaluateAcademicIngestion(
  registry: AcademicInstitutionRegistry,
  candidate: AcademicIngestionCandidate,
): AcademicIngestionDecision {
  const rejectReasons: AcademicIngestionReason[] = [];
  const reviewReasons: AcademicIngestionReason[] = [];
  const candidateId = clean(candidate.candidateId) || "unknown-candidate";
  const institutionId = clean(candidate.institutionId) || "";

  const registryIssues = validateAcademicInstitutionRegistry(registry);
  if (registryIssues.length) {
    return {
      status: "reject",
      candidateId,
      institutionId,
      sourceAuthority: null,
      sourceKind: null,
      reasons: [{
        code: "registry_invalid",
        detail: registryIssues.map(issue => `${issue.code}:${issue.detail}`).join(","),
      }],
    };
  }

  if (!clean(candidate.candidateId)) rejectReasons.push({ code: "missing_candidate_id", detail: "candidateId" });
  if (!institutionId) rejectReasons.push({ code: "missing_institution", detail: "institutionId" });

  const institution = registry.find(item => item.institutionId === institutionId);
  if (institutionId && !institution) rejectReasons.push({ code: "unknown_institution", detail: institutionId });

  const allSources = sourceIndex(registry);
  const registered = allSources.get(candidate.source.sourceId) || null;
  if (registered && registered.institution.institutionId !== institutionId) {
    rejectReasons.push({
      code: "source_institution_mismatch",
      detail: `${candidate.source.sourceId}:${registered.institution.institutionId}:${institutionId}`,
    });
  }

  if (registered && registered.institution.institutionId === institutionId) {
    if (registered.source.active === false) {
      rejectReasons.push({ code: "source_disabled", detail: registered.source.sourceId });
    }
    if (!registered.source.channels.includes(candidate.source.channel)) {
      rejectReasons.push({
        code: "source_channel_mismatch",
        detail: `${registered.source.sourceId}:${candidate.source.channel}`,
      });
    }

    if (registered.source.authority === "official") {
      if (!candidate.source.sourceUri) {
        rejectReasons.push({ code: "source_uri_required", detail: registered.source.sourceId });
      } else {
        const parsed = parsedHttpsUrl(candidate.source.sourceUri);
        if (!parsed) {
          rejectReasons.push({ code: "source_uri_invalid", detail: candidate.source.sourceUri });
        } else if (!(registered.source.allowedHosts || []).some(host => hostMatchesDomain(parsed.hostname, host))) {
          rejectReasons.push({ code: "source_host_mismatch", detail: parsed.hostname });
        }
      }
    }
  } else if (!registered && institution) {
    reviewReasons.push({ code: "unregistered_source", detail: candidate.source.sourceId });
    reviewReasons.push({ code: "untrusted_source_requires_review", detail: candidate.source.channel });
  }

  if (!candidate.term) reviewReasons.push({ code: "missing_term", detail: "term" });
  if (!clean(candidate.courseIdentityId)) reviewReasons.push({ code: "missing_course_identity", detail: "courseIdentityId" });
  if (!clean(candidate.courseCode)) reviewReasons.push({ code: "missing_course_code", detail: "courseCode" });
  if (!clean(candidate.courseName)) reviewReasons.push({ code: "missing_course_name", detail: "courseName" });
  if (!candidate.offering) reviewReasons.push({ code: "missing_offering", detail: "offering" });

  const confidenceValid = candidate.extraction.confidence === undefined || (
    Number.isFinite(candidate.extraction.confidence) &&
    candidate.extraction.confidence >= 0 &&
    candidate.extraction.confidence <= 1
  );
  if (!confidenceValid) {
    rejectReasons.push({ code: "invalid_extraction_confidence", detail: String(candidate.extraction.confidence) });
  }

  const observedAtValid = Number.isFinite(Date.parse(candidate.source.observedAt));
  if (!observedAtValid) {
    rejectReasons.push({ code: "invalid_observed_at", detail: candidate.source.observedAt });
  }

  if (candidate.extraction.method === "ocr" && registered?.source.authority !== "reviewed") {
    reviewReasons.push({ code: "ocr_requires_review", detail: candidate.source.channel });
  }
  if (candidate.extraction.method === "manual" && registered?.source.authority !== "reviewed") {
    reviewReasons.push({ code: "manual_requires_review", detail: candidate.source.channel });
  }

  const unresolved = [...new Set(candidate.unresolvedContext || [])];
  if (unresolved.includes("institution")) {
    rejectReasons.push({ code: "unresolved_context", detail: "institution" });
  }
  for (const field of unresolved.filter(field => field !== "institution")) {
    reviewReasons.push({ code: "unresolved_context", detail: field });
  }

  if (candidate.offering) {
    const offeringIssues = validateAcademicOffering(candidate.offering);
    if (offeringIssues.length) {
      rejectReasons.push({
        code: "invalid_offering",
        detail: offeringIssues.map(issue => `${issue.code}:${issue.detail}`).join(","),
      });
    }
  }

  const mismatches = contextMismatch(candidate);
  if (mismatches.length) {
    rejectReasons.push({ code: "context_mismatch", detail: mismatches.join(",") });
  }

  if (registered && registered.institution.institutionId === institutionId && observedAtValid && confidenceValid) {
    const observation = provisionalObservation(candidate, registered);
    if (observation) {
      const observationIssues = validateAcademicObservation(observation);
      if (observationIssues.length) {
        rejectReasons.push({
          code: "context_mismatch",
          detail: observationIssues.map(issue => `${issue.code}:${issue.detail}`).join(","),
        });
      }
    }
  }

  const sourceAuthority = registered?.source.authority || null;
  const sourceKind = registered?.source.kind || null;
  if (rejectReasons.length) {
    return { status: "reject", candidateId, institutionId, sourceAuthority, sourceKind, reasons: rejectReasons };
  }
  if (reviewReasons.length || !registered) {
    return { status: "review", candidateId, institutionId, sourceAuthority, sourceKind, reasons: reviewReasons };
  }

  return { status: "accept", candidateId, institutionId, sourceAuthority, sourceKind, reasons: [] };
}

export function academicIngestionToObservation(
  registry: AcademicInstitutionRegistry,
  candidate: AcademicIngestionCandidate,
): AcademicOfferingObservation | null {
  const decision = evaluateAcademicIngestion(registry, candidate);
  if (decision.status !== "accept") return null;
  const registered = sourceIndex(registry).get(candidate.source.sourceId);
  if (!registered) return null;
  return provisionalObservation(candidate, registered);
}
