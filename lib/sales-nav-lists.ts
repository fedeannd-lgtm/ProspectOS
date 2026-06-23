/**
 * Appends a new INCLUDED account list entry to the ACCOUNT_LIST section of a
 * Sales Navigator People Search URL. Does NOT touch existing list entries.
 */
export function updateAccountListInUrl(
  currentUrl: string,
  newListId: string,
  newListName: string
): string {
  const ACCOUNT_LIST_MARKER = 'type%3AACCOUNT_LIST'

  const markerIdx = currentUrl.indexOf(ACCOUNT_LIST_MARKER)
  if (markerIdx === -1) return currentUrl

  // Walk back to find the opening ( of the type:ACCOUNT_LIST group
  const openIdx = currentUrl.lastIndexOf('(', markerIdx)

  // Count parens to find the matching closing )
  let depth = 0
  let closeIdx = -1
  for (let i = openIdx; i < currentUrl.length; i++) {
    if (currentUrl[i] === '(') depth++
    else if (currentUrl[i] === ')') {
      depth--
      if (depth === 0) { closeIdx = i; break }
    }
  }

  if (closeIdx === -1) return currentUrl

  const encodedName = encodeURIComponent(newListName)
    .replace(/%20/g, '%2520')
    .replace(/%2C/g, '%252C')
    .replace(/%3A/g, '%253A')

  // Replace the entire ACCOUNT_LIST block with a clean one containing only the selected list
  const newGroup = `(type%3AACCOUNT_LIST%2Cvalues%3AList((id%3A${newListId}%2Ctext%3A${encodedName}%2CselectionType%3AINCLUDED%2Cicon%3Alist)))`

  return currentUrl.slice(0, openIdx) + newGroup + currentUrl.slice(closeIdx + 1)
}
