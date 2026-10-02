import { query } from "../db.js";

export function createCommercialIntelligenceRepository(queryFn = query) {
  async function rows(sql, params = []) {
    return (await queryFn(sql, params)).rows;
  }

  async function one(sql, params = []) {
    return (await rows(sql, params))[0] || null;
  }

  return {
    listCompanies() {
      return rows(`select company.*,
        (select count(*)::int from commercial_signals signal where signal.company_id = company.id) as signal_count,
        (select count(*)::int from commercial_opportunities opportunity where opportunity.company_id = company.id) as opportunity_count
        from commercial_companies company order by company.updated_at desc`);
    },

    getCompany(id) {
      return one("select * from commercial_companies where id = $1", [id]);
    },

    createCompany(input, userId) {
      return one(`insert into commercial_companies (
        name, normalized_name, legal_name, website, country, region, aviation_segment,
        company_type, fleet_information, aviation_activities, known_contract_categories,
        operational_characteristics, likely_pain_points, operion_relevance, internal_notes,
        origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17)
      returning *`, [input.name, input.normalizedName, input.legalName, input.website, input.country,
        input.region, input.aviationSegment, input.companyType, input.fleetInformation,
        JSON.stringify(input.aviationActivities), JSON.stringify(input.knownContractCategories),
        JSON.stringify(input.operationalCharacteristics), JSON.stringify(input.likelyPainPoints),
        input.operionRelevance, input.internalNotes, input.origin, userId]);
    },

    listPeople(companyId = null) {
      return rows(`select person.*, company.name as company_name
        from commercial_people person join commercial_companies company on company.id = person.company_id
        where ($1::uuid is null or person.company_id = $1) order by person.updated_at desc`, [companyId]);
    },

    getPerson(id) {
      return one("select * from commercial_people where id = $1", [id]);
    },

    createPerson(input, userId) {
      return one(`insert into commercial_people (
        company_id, name, role_title, role_category, linkedin_url, email, relevance_reason,
        decision_scope, confidence, verification_status, verification_source_id, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
      [input.companyId, input.name, input.roleTitle, input.roleCategory, input.linkedinUrl,
        input.email, input.relevanceReason, input.decisionScope, input.confidence,
        input.verificationStatus, input.verificationSourceId, input.origin, userId]);
    },

    listSignals(companyId = null) {
      return rows(`select signal.*, company.name as company_name
        from commercial_signals signal join commercial_companies company on company.id = signal.company_id
        where ($1::uuid is null or signal.company_id = $1)
        order by signal.signal_date desc nulls last, signal.created_at desc`, [companyId]);
    },

    getSignal(id) {
      return one("select * from commercial_signals where id = $1", [id]);
    },

    createSignal(input, userId) {
      return one(`insert into commercial_signals (
        company_id, signal_type, title, description, extracted_fact, ai_interpretation,
        signal_date, confidence, relevance, operion_implication, source_id, review_status,
        verification_status, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [input.companyId, input.signalType, input.title, input.description, input.extractedFact,
        input.aiInterpretation, input.signalDate, input.confidence, input.relevance,
        input.operionImplication, input.sourceId, input.reviewStatus,
        input.verificationStatus, input.origin, userId]);
    },

    updateSignalReviewStatus(id, status) {
      return one("update commercial_signals set review_status = $2, updated_at = now() where id = $1 returning *", [id, status]);
    },

    listOpportunities() {
      return rows(`select opportunity.*, company.name as company_name, person.name as key_person_name,
        person.role_title as key_person_role, signal.description as signal_description
        from commercial_opportunities opportunity
        join commercial_companies company on company.id = opportunity.company_id
        left join commercial_people person on person.id = opportunity.key_person_id
        left join commercial_signals signal on signal.id = opportunity.signal_id
        order by opportunity.updated_at desc`);
    },

    getOpportunity(id) {
      return one(`select opportunity.*, company.name as company_name, company.aviation_segment,
        company.fleet_information, company.operion_relevance as company_operion_relevance,
        person.name as key_person_name, person.role_title as key_person_role,
        person.role_category as key_person_role_category, person.relevance_reason as person_relevance_reason,
        person.decision_scope as person_decision_scope, signal.description as signal_description,
        signal.signal_type, signal.signal_date, signal.verification_status as signal_verification_status
        from commercial_opportunities opportunity
        join commercial_companies company on company.id = opportunity.company_id
        left join commercial_people person on person.id = opportunity.key_person_id
        left join commercial_signals signal on signal.id = opportunity.signal_id
        where opportunity.id = $1`, [id]);
    },

    createOpportunity(input, userId) {
      return one(`insert into commercial_opportunities (
        company_id, signal_id, key_person_id, primary_source_id, title, opportunity_type, aviation_segment,
        potential_contract_use_case, why_company, why_now, why_operion, why_person,
        value_hypothesis, recommended_approach, suggested_outreach, primary_next_action,
        secondary_action, status, priority, priority_reasons, reasoning_method, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18,$19,$20::jsonb,$21,$22,$23)
      returning *`, [input.companyId, input.signalId, input.keyPersonId, input.primarySourceId,
        input.title, input.opportunityType, input.aviationSegment, input.potentialContractUseCase,
        input.whyCompany, input.whyNow, input.whyOperion, input.whyPerson, input.valueHypothesis,
        JSON.stringify(input.recommendedApproach), JSON.stringify(input.suggestedOutreach),
        input.primaryNextAction, input.secondaryAction, input.status, input.priority,
        JSON.stringify(input.priorityReasons), input.reasoningMethod, input.origin, userId]);
    },

    updateOpportunity(id, input) {
      return one(`update commercial_opportunities set
        key_person_id = coalesce($2, key_person_id), status = coalesce($3, status),
        priority = coalesce($4, priority), priority_reasons = coalesce($5::jsonb, priority_reasons),
        why_company = coalesce($6, why_company), why_now = coalesce($7, why_now),
        why_operion = coalesce($8, why_operion), why_person = coalesce($9, why_person),
        recommended_approach = coalesce($10::jsonb, recommended_approach),
        suggested_outreach = coalesce($11::jsonb, suggested_outreach),
        primary_next_action = coalesce($12, primary_next_action),
        secondary_action = coalesce($13, secondary_action), reasoning_method = coalesce($14, reasoning_method),
        last_reviewed_at = case when $15::boolean then now() else last_reviewed_at end, updated_at = now()
        where id = $1 returning *`, [id, input.keyPersonId, input.status, input.priority,
        input.priorityReasons ? JSON.stringify(input.priorityReasons) : null, input.whyCompany,
        input.whyNow, input.whyOperion, input.whyPerson,
        input.recommendedApproach ? JSON.stringify(input.recommendedApproach) : null,
        input.suggestedOutreach ? JSON.stringify(input.suggestedOutreach) : null,
        input.primaryNextAction, input.secondaryAction, input.reasoningMethod, input.markReviewed || false]);
    },

    createSource(input, userId) {
      return one(`insert into commercial_sources (
        title, publisher, source_url, canonical_url, normalized_url, domain,
        original_url_hash, normalized_url_hash, content_hash, published_at, excerpt,
        source_type, verification_status, content_status, duplicate_status,
        quality_confidence, duplicate_of_source_id, duplicate_reason, duplicate_confidence, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      returning *`, [input.title, input.publisher, input.sourceUrl, input.canonicalUrl,
        input.normalizedUrl, input.domain, input.originalUrlHash, input.normalizedUrlHash,
        input.contentHash, input.publishedAt, input.excerpt, input.sourceType,
        input.verificationStatus, input.excerpt ? "PROVIDED" : "UNAVAILABLE",
        input.duplicateStatus, input.qualityConfidence, input.duplicateOfSourceId, input.duplicateReason,
        input.duplicateConfidence, userId]);
    },

    getSource(id) {
      return one("select * from commercial_sources where id = $1", [id]);
    },

    findSourceDuplicateCandidates(input) {
      return rows(`select id, title, source_url, domain, original_url_hash, normalized_url_hash, content_hash
        from commercial_sources
        where ($1::text is not null and original_url_hash = $1)
          or ($2::text is not null and normalized_url_hash = $2)
          or ($3::text is not null and content_hash = $3)
          or ($4::text is not null and domain = $4)
        order by created_at desc limit 25`, [input.originalUrlHash, input.normalizedUrlHash, input.contentHash, input.domain]);
    },

    listSourceReviewQueue(status = null) {
      return rows(`select source.*, duplicate.title as duplicate_of_title,
        duplicate.source_url as duplicate_of_url
        from commercial_sources source
        left join commercial_sources duplicate on duplicate.id = source.duplicate_of_source_id
        where (($1::text is null and source.review_status in ('NEW', 'DEFERRED')) or source.review_status = $1)
        order by case source.review_status when 'NEW' then 0 when 'DEFERRED' then 1 else 2 end,
          source.created_at desc`, [status]);
    },

    updateSourceExtractionStatus(id, status) {
      return one("update commercial_sources set extraction_status = $2, updated_at = now() where id = $1 returning *", [id, status]);
    },

    reviewSource(id, input, userId) {
      return one(`with existing as (
          select id, review_status from commercial_sources where id = $1 for update
        ), updated as (
          update commercial_sources source set review_status = $2,
            verification_status = case when $2 = 'VERIFIED' then 'VERIFIED_FACT' else verification_status end,
            title = coalesce($6::jsonb->>'title', title),
            publisher = coalesce($6::jsonb->>'publisher', publisher),
            source_url = coalesce($6::jsonb->>'sourceUrl', source_url),
            canonical_url = coalesce($6::jsonb->>'canonicalUrl', canonical_url),
            normalized_url = coalesce($6::jsonb->>'normalizedUrl', normalized_url),
            domain = coalesce($6::jsonb->>'domain', domain),
            original_url_hash = coalesce($6::jsonb->>'originalUrlHash', original_url_hash),
            normalized_url_hash = coalesce($6::jsonb->>'normalizedUrlHash', normalized_url_hash),
            content_hash = coalesce($6::jsonb->>'contentHash', content_hash),
            excerpt = coalesce($6::jsonb->>'excerpt', excerpt),
            source_type = coalesce($6::jsonb->>'sourceType', source_type),
            quality_confidence = coalesce(($6::jsonb->>'qualityConfidence')::numeric, quality_confidence),
            duplicate_status = coalesce($6::jsonb->>'duplicateStatus', duplicate_status),
            duplicate_of_source_id = case when $6::jsonb ? 'duplicateOfSourceId' then nullif($6::jsonb->>'duplicateOfSourceId', '')::uuid else duplicate_of_source_id end,
            duplicate_reason = case when $6::jsonb ? 'duplicateReason' then $6::jsonb->>'duplicateReason' else duplicate_reason end,
            duplicate_confidence = case when $6::jsonb ? 'duplicateConfidence' then ($6::jsonb->>'duplicateConfidence')::numeric else duplicate_confidence end,
            reviewed_by = $3, reviewed_at = now(), updated_at = now()
          from existing where source.id = existing.id
          returning source.*, existing.review_status as previous_review_status
        ), audited as (
          insert into commercial_review_decisions (
            subject_type, subject_id, previous_status, new_status, decision, reason, changes, actor_id
          ) select 'SOURCE', id, previous_review_status, review_status, $4, $5, $6::jsonb, $3 from updated
          returning id
        ) select updated.* from updated, audited`, [id, input.reviewStatus, userId,
        input.decision, input.reason, JSON.stringify(input.changes)]);
    },

    createAiProposal(input, userId) {
      return one(`insert into commercial_ai_proposals (
        source_id, proposal_type, proposed_data, evidence, confidence, created_by
      ) values ($1,$2,$3::jsonb,$4::jsonb,$5,$6) returning *`, [input.sourceId,
        input.proposalType, JSON.stringify(input.proposedData), JSON.stringify(input.evidence || []),
        input.confidence, userId]);
    },

    getAiProposal(id) {
      return one("select * from commercial_ai_proposals where id = $1", [id]);
    },

    listAiProposals(status = null) {
      return rows(`select proposal.*, source.title as source_title, source.source_url
        from commercial_ai_proposals proposal join commercial_sources source on source.id = proposal.source_id
        where (($1::text is null and proposal.status in ('NEW', 'EDITED', 'DEFERRED')) or proposal.status = $1)
        order by proposal.created_at desc`, [status]);
    },

    reviewAiProposal(id, input, promotedEntityId, userId) {
      return one(`with existing as (
          select id, status from commercial_ai_proposals where id = $1 for update
        ), updated as (
          update commercial_ai_proposals proposal set status = $2,
            proposed_data = case when $3::jsonb = '{}'::jsonb then proposed_data else proposed_data || $3::jsonb end,
            promoted_entity_id = $4, reviewed_by = $5, reviewed_at = now(), updated_at = now()
          from existing where proposal.id = existing.id
          returning proposal.*, existing.status as previous_review_status
        ), audited as (
          insert into commercial_review_decisions (
            subject_type, subject_id, previous_status, new_status, decision, reason, changes, actor_id
          ) select 'AI_PROPOSAL', id, previous_review_status, status, $6, $7, $3::jsonb, $5 from updated
          returning id
        ) select updated.* from updated, audited`, [id, input.status, JSON.stringify(input.changes),
        promotedEntityId, userId, input.decision, input.reason]);
    },

    createEntityMatchProposal(input, userId) {
      return one(`insert into commercial_entity_match_proposals (
        source_id, entity_type, candidate_entity_id, proposed_entity, match_evidence,
        confidence, status, created_by
      ) values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8) returning *`, [input.sourceId,
        input.entityType, input.candidateEntityId, JSON.stringify(input.proposedEntity),
        JSON.stringify(input.matchEvidence), input.confidence, input.status, userId]);
    },

    getEntityMatchProposal(id) {
      return one("select * from commercial_entity_match_proposals where id = $1", [id]);
    },

    listEntityMatchProposals(status = null) {
      return rows(`select entity_match.*, source.title as source_title from commercial_entity_match_proposals entity_match
        join commercial_sources source on source.id = entity_match.source_id
        where (($1::text is null and entity_match.status in ('NEW', 'DEFERRED')) or entity_match.status = $1)
        order by entity_match.created_at desc`, [status]);
    },

    reviewEntityMatchProposal(id, input, userId) {
      return one(`with existing as (
          select id, status from commercial_entity_match_proposals where id = $1 for update
        ), updated as (
          update commercial_entity_match_proposals match set status = $2,
            reviewed_by = $3, reviewed_at = now(), updated_at = now()
          from existing where match.id = existing.id
          returning match.*, existing.status as previous_review_status
        ), audited as (
          insert into commercial_review_decisions (
            subject_type, subject_id, previous_status, new_status, decision, reason, changes, actor_id
          ) select 'ENTITY_MATCH', id, previous_review_status, status, $4, $5, '{}'::jsonb, $3 from updated
          returning id
        ) select updated.* from updated, audited`, [id, input.status, userId, input.decision, input.reason]);
    },

    listReviewDecisions(subjectType, subjectId) {
      return rows(`select decision.*, actor.email as actor_email
        from commercial_review_decisions decision
        left join auth.users actor on actor.id = decision.actor_id
        where decision.subject_type = $1 and decision.subject_id = $2
        order by decision.created_at desc`, [subjectType, subjectId]);
    },

    linkSource(input) {
      return one(`insert into commercial_evidence_links (source_id, entity_type, entity_id, claim, support_type)
        values ($1,$2,$3,$4,$5) on conflict (source_id, entity_type, entity_id, claim)
        do update set support_type = excluded.support_type returning *`,
      [input.sourceId, input.entityType, input.entityId, input.claim, input.supportType]);
    },

    listSources(entityType, entityId) {
      return rows(`select source.*, link.claim, link.support_type
        from commercial_evidence_links link join commercial_sources source on source.id = link.source_id
        where link.entity_type = $1 and link.entity_id = $2 order by source.published_at desc nulls last, source.created_at desc`,
      [entityType, entityId]);
    },

    listRecommendedActions(opportunityId = null) {
      return rows(`select action.*, opportunity.title as opportunity_title,
        company.id as company_id, company.name as company_name,
        person.name as person_name, person.role_title as person_role,
        source.title as evidence_title, source.source_url as evidence_url,
        source.excerpt as evidence_excerpt
        from commercial_recommended_actions action
        join commercial_opportunities opportunity on opportunity.id = action.opportunity_id
        join commercial_companies company on company.id = opportunity.company_id
        left join commercial_people person on person.id = action.person_id
        join commercial_sources source on source.id = action.evidence_source_id
        where ($1::uuid is null or action.opportunity_id = $1)
        order by action.updated_at desc`, [opportunityId]);
    },

    getRecommendedAction(id) {
      return one("select * from commercial_recommended_actions where id = $1", [id]);
    },

    createRecommendedAction(input, userId) {
      return one(`insert into commercial_recommended_actions (
        opportunity_id, person_id, evidence_source_id, action_type, action_text,
        reason, confidence, status, reasoning_method, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (opportunity_id, action_type, action_text) do update set
        person_id = excluded.person_id, evidence_source_id = excluded.evidence_source_id,
        reason = excluded.reason, confidence = excluded.confidence,
        reasoning_method = excluded.reasoning_method, updated_at = now()
      returning *`, [input.opportunityId, input.personId, input.evidenceSourceId,
        input.actionType, input.actionText, input.reason, input.confidence,
        input.status, input.reasoningMethod, userId]);
    },

    updateRecommendedAction(id, status) {
      return one("update commercial_recommended_actions set status = $2, updated_at = now() where id = $1 returning *", [id, status]);
    },
  };
}

export default createCommercialIntelligenceRepository;