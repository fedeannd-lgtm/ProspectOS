/**
 * Replaces (or inserts) the INCLUDED account list entry in a Sales Navigator People Search URL.
 * Returns { url, replaced: true } if the list was swapped, or { url, replaced: false } if no
 * existing ACCOUNT_LIST section was found (meaning the base URL needs one first).
 */
export function updateAccountListInUrl(
  currentUrl: string,
  newListId: string,
  newListName: string
): { url: string; replaced: boolean } {
  const encodedName = encodeURIComponent(newListName)
    .replace(/%20/g, '%2520')
    .replace(/%2C/g, '%252C')
    .replace(/%3A/g, '%253A')

  const newEntry = `id%3A${newListId}%2Ctext%3A${encodedName}%2CselectionType%3AINCLUDED%2Cicon%3Alist`

  // Pattern 1: encoded commas (%2C) — typical Sales Nav URL
  let result = currentUrl.replace(
    /id%3A\d+%2Ctext%3A[^)]*?selectionType%3AINCLUDED%2Cicon%3Alist/,
    newEntry
  )
  if (result !== currentUrl) return { url: result, replaced: true }

  // Pattern 2: literal commas — some Sales Nav variants
  const newEntryComma = `id%3A${newListId},text%3A${encodeURIComponent(newListName)},selectionType%3AINCLUDED,icon%3Alist`
  result = currentUrl.replace(
    /id%3A\d+,text%3A[^)]*?,selectionType%3AINCLUDED,icon%3Alist/,
    newEntryComma
  )
  if (result !== currentUrl) return { url: result, replaced: true }

  return { url: currentUrl, replaced: false }
}

/** Extracts the listId of the currently INCLUDED account list from a people search URL */
export function getCurrentIncludedListId(url: string): string | null {
  const match = url.match(/id%3A(\d+)[,%].*?selectionType%3AINCLUDED/)
  return match ? match[1] : null
}
