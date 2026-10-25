/** Developer access requires BOTH the developer role and the correct secret code. */
export function isDeveloperAuthorized(hasDeveloperRole: boolean, providedCode: string | undefined, expectedCode: string | undefined) {
  if (!hasDeveloperRole) return false;
  if (!expectedCode || !providedCode) return false;
  if (providedCode.length !== expectedCode.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedCode.length; i++) diff |= providedCode.charCodeAt(i) ^ expectedCode.charCodeAt(i);
  return diff === 0;
}
