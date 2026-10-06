import { TERMINAL_LEAD_STATUSES, type LeadStatus } from "@/lib/domain/enums";

type ContactFields = { status: LeadStatus; doNotContact: boolean };

/**
 * The single gate every queue, follow-up and send path must go through.
 * A lead that asked not to be contacted is never contactable, whatever its score.
 */
export function isContactBlocked(lead: ContactFields): boolean {
  return lead.doNotContact || lead.status === "DO_NOT_CONTACT";
}

/** True while the lead is still part of the active sales pipeline. */
export function isActiveLead(lead: ContactFields): boolean {
  if (isContactBlocked(lead)) return false;
  return !(TERMINAL_LEAD_STATUSES as readonly LeadStatus[]).includes(lead.status);
}
