const STORAGE_KEY = 'smartdoc:custom-document-folders:v1'

export const getCustomDocumentFolders = () => {
  const value = localStorage.getItem(STORAGE_KEY)
  if (!value) return {}

  const parsed = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved document folders have an invalid format.')
  }

  return parsed
}

export const saveCustomDocumentFolder = (category, folderName, existingNames = []) => {
  const cleanCategory = String(category || '').trim()
  const cleanName = String(folderName || '').trim().replace(/\s+/g, ' ')
  if (!cleanCategory || !cleanName) {
    throw new Error('Choose an exam category and enter a folder name.')
  }

  const folders = getCustomDocumentFolders()
  const names = Array.isArray(folders[cleanCategory]) ? folders[cleanCategory] : []
  const allNames = [...names, ...existingNames]
  if (allNames.some((name) => String(name).toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    throw new Error(`A "${cleanName}" subfolder already exists in ${cleanCategory}.`)
  }

  folders[cleanCategory] = [...names, cleanName]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
  return folders
}

export const ensureCustomDocumentFolder = (category, folderName) => {
  const cleanCategory = String(category || '').trim()
  const cleanName = String(folderName || '').trim()
  const folders = getCustomDocumentFolders()
  const names = Array.isArray(folders[cleanCategory]) ? folders[cleanCategory] : []

  if (names.some((name) => String(name).toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    return folders
  }

  return saveCustomDocumentFolder(cleanCategory, cleanName)
}

export const deleteCustomDocumentFolder = (category, folderName) => {
  const cleanCategory = String(category || '').trim()
  const cleanName = String(folderName || '').trim()
  const folders = getCustomDocumentFolders()
  const names = Array.isArray(folders[cleanCategory]) ? folders[cleanCategory] : []
  const remaining = names.filter((name) =>
    String(name).toLocaleLowerCase() !== cleanName.toLocaleLowerCase()
  )

  if (remaining.length === names.length) {
    throw new Error(`The "${cleanName}" custom subfolder was not found.`)
  }

  if (remaining.length) {
    folders[cleanCategory] = remaining
  } else {
    delete folders[cleanCategory]
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
  return folders
}
