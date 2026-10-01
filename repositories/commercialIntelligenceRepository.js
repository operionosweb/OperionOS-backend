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
        decision_scope, confidence, verification_status, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [input.companyId, input.name, input.roleTitle, input.roleCategory, input.linkedinUrl,
        input.email, input.relevanceReason, input.decisionScope, input.confidence,
        input.verificationStatus, input.origin, userId]);
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
        company_id, signal_type, description, signal_date, confidence, relevance,
        operion_implication, verification_status, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [input.companyId, input.signalType, input.description, input.signalDate, input.confidence,
        input.relevance, input.operionImplication, input.verificationStatus, input.origin, userId]);
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
        company_id, signal_id, key_person_id, title, opportunity_type, aviation_segment,
        potential_contract_use_case, why_company, why_now, why_operion, why_person,
        value_hypothesis, recommended_approach, suggested_outreach, primary_next_action,
        secondary_action, status, priority, priority_reasons, reasoning_method, origin, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19::jsonb,$20,$21,$22)
      returning *`, [input.companyId, input.signalId, input.keyPersonId, input.title,
        input.opportunityType, input.aviationSegment, input.potentialContractUseCase,
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
        title, publisher, source_url, published_at, excerpt, source_type, verification_status, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [input.title, input.publisher,
        input.sourceUrl, input.publishedAt, input.excerpt, input.sourceType, input.verificationStatus, userId]);
    },

    getSource(id) {
      return one("select * from commercial_sources where id = $1", [id]);
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
  };
}

export default createCommercialIntelligenceRepository;