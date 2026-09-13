import type {
  StudySuspensionEvent,
  StudySuspensionProfile,
  StudySuspensionRecipient,
  StudySuspensionSource,
} from "./studySuspension.ts";

export type EducationIdentity = {
  userId: string;
  externalProvider?: string;
  externalSubject?: string;
};

export type EducationNotificationChannel = "push" | "telegram";

export interface IdentityGateway {
  resolveUser(input: { externalProvider: string; externalSubject: string }): Promise<EducationIdentity | null>;
}

export interface EducationRepository {
  loadProfile(userId: string): Promise<StudySuspensionProfile | null>;
  listTestRecipientIds(): Promise<string[]>;
  loadRecipient(userId: string, profile: StudySuspensionProfile): Promise<StudySuspensionRecipient>;
  listTrustedSources(): Promise<StudySuspensionSource[]>;
  readSourceCursor(sourceId: string): Promise<string>;
  writeSourceCursor(sourceId: string, cursor: string): Promise<void>;
  claimDelivery(input: { recipientId: string; channel: EducationNotificationChannel; dedupKey: string }): Promise<boolean>;
  releaseDelivery(input: { recipientId: string; channel: EducationNotificationChannel; dedupKey: string }): Promise<void>;
  appendAudit(input: { actorId?: string; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }): Promise<void>;
}

export interface NotificationGateway {
  sendPush(recipient: StudySuspensionRecipient, event: StudySuspensionEvent): Promise<boolean>;
  sendTelegram(recipient: StudySuspensionRecipient, event: StudySuspensionEvent): Promise<boolean>;
}

export interface OfficialSourceGateway {
  fetchNewEvents(input: { sourceId: string; cursor?: string }): Promise<{ events: StudySuspensionEvent[]; newestCursor?: string }>;
}

export type EducationRuntimePorts = {
  identity: IdentityGateway;
  repository: EducationRepository;
  notifications: NotificationGateway;
  officialSources: OfficialSourceGateway;
};
