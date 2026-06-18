/**
 * Updates the ACCOUNT_LIST filter in a Sales Navigator People Search URL:
 * - Changes the previously INCLUDED list to EXCLUDED
 * - Adds the new list as INCLUDED
 *
 * The URL fragment uses a mix of literal parentheses and percent-encoded
 * commas/colons, e.g.:
 *   (type%3AACCOUNT_LIST%2Cvalues%3AList((id%3A123%2Ctext%3AFoo%2CselectionType%3AINCLUDED%2Cicon%3Alist)))
 */
export function updateAccountListInUrl(
  currentUrl: string,
  newListId: string,
  newListName: string
): string {
  const ACCOUNT_LIST_MARKER = 'type%3AACCOUNT_LIST'

  // 1. Change currently INCLUDED list to EXCLUDED
  let updated = currentUrl.replace(
    /%2CselectionType%3AINCLUDED%2Cicon%3Alist/g,
    '%2CselectionType%3AEXCLUDED'
  )

  // 2. Find the ACCOUNT_LIST section and append the new entry before its closing ))
  const markerIdx = updated.indexOf(ACCOUNT_LIST_MARKER)
  if (markerIdx === -1) {
    console.warn('No ACCOUNT_LIST section found in URL — returning unchanged')
    return currentUrl
  }

  // Walk back to find the opening ( of the type:ACCOUNT_LIST group
  const openIdx = updated.lastIndexOf('(', markerIdx)

  // Count parens to find the matching closing )
  let depth = 0
  let closeIdx = -1
  for (let i = openIdx; i < updated.length; i++) {
    if (updated[i] === '(') depth++
    else if (updated[i] === ')') {
      depth--
      if (depth === 0) {
        closeIdx = i
        break
      }
    }
  }

  if (closeIdx === -1) {
    console.warn('Could not find closing paren for ACCOUNT_LIST section')
    return currentUrl
  }

  // The structure ends with: ...lastEntry)) where:
  //   first ) closes the last (id:...) entry
  //   second ) closes values:List(
  //   third ) closes (type:ACCOUNT_LIST,...)  ← this is closeIdx
  // We want to insert the new entry before the )) that closes values:List + outer

  const encodedName = encodeURIComponent(newListName)
    .replace(/%20/g, '%2520')
    .replace(/%2C/g, '%252C')
    .replace(/%3A/g, '%253A')

  const newEntry = `%2C(id%3A${newListId}%2Ctext%3A${encodedName}%2CselectionType%3AINCLUDED%2Cicon%3Alist)`

  // Insert the new entry just before the two closing )) at the end of the section
  // closeIdx points to the last ) — the one before it closes values:List
  // So we insert at closeIdx - 1 (before the second-to-last ))
  const insertAt = closeIdx - 1

  updated =
    updated.slice(0, insertAt) +
    newEntry +
    updated.slice(insertAt)

  return updated
}

/** Extracts the listId of the currently INCLUDED account list from a people search URL */
export function getCurrentIncludedListId(url: string): string | null {
  const match = url.match(/id%3A(\d+)%2C[^)]*selectionType%3AINCLUDED%2Cicon%3Alist/)
  return match ? match[1] : null
}
