/**
 * Replaces the INCLUDED account list entry in a Sales Navigator People Search URL.
 * Only swaps the id and text of the existing INCLUDED entry — nothing else is touched.
 */
export function updateAccountListInUrl(
  currentUrl: string,
  newListId: string,
  newListName: string
): string {
  const encodedName = encodeURIComponent(newListName)
    .replace(/%20/g, '%2520')
    .replace(/%2C/g, '%252C')
    .replace(/%3A/g, '%253A')

  const newEntry = `id%3A${newListId}%2Ctext%3A${encodedName}%2CselectionType%3AINCLUDED%2Cicon%3Alist`

  const result = currentUrl.replace(
    /id%3A\d+%2Ctext%3A[^)]*selectionType%3AINCLUDED%2Cicon%3Alist/,
    newEntry
  )

  return result
}

/** Extracts the listId of the currently INCLUDED account list from a people search URL */
export function getCurrentIncludedListId(url: string): string | null {
  const match = url.match(/id%3A(\d+)%2C[^)]*selectionType%3AINCLUDED%2Cicon%3Alist/)
  return match ? match[1] : null
}
