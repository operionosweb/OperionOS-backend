const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertOrganizationScope(organizationId) {
  if (!UUID_PATTERN.test(organizationId || "")) {
    const error = new TypeError("A valid organization scope is required");
    error.code = "ORGANIZATION_ACCESS_DENIED";
    throw error;
  }

  return organizationId;
}

export function assertResourceId(resourceId, name = "resourceId") {
  if (!UUID_PATTERN.test(resourceId || "")) {
    throw new TypeError(`${name} must be a valid UUID`);
  }

  return resourceId;
}
