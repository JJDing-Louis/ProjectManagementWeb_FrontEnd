export function mapRegistrationFieldErrors(errors: Record<string, string>): Record<string, string> {
  const mapped = { ...errors }
  if (mapped.name) {
    mapped.displayName = mapped.name
    delete mapped.name
  }
  return mapped
}
