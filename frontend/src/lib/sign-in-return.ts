const LOCAL_ORIGIN = "https://commons.invalid";

/** Accept only same-site paths, including their query and fragment, never a network redirect. */
export function signInReturnPath(value: string | null): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\p{Cc}]/u.test(value)
  )
    return "/";
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    return url.origin === LOCAL_ORIGIN
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export function signInHref(path: string): string {
  return `/login?next=${encodeURIComponent(signInReturnPath(path))}`;
}
