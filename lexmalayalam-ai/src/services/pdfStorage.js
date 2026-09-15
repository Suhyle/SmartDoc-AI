// =========================================================
// SmartDoc AI - Local PDF Storage
// =========================================================

const DB_NAME = 'SmartDocAI_DB'
const DB_VERSION = 2
const STORE_NAME = 'pdfs'


// =========================================================
// OPEN DATABASE
// =========================================================

const openDatabase = () => {

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    )


    request.onupgradeneeded = (event) => {

      const db = event.target.result


      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store =
          db.createObjectStore(
            STORE_NAME,
            {
              keyPath: 'id'
            }
          )


        store.createIndex(
          'createdAt',
          'createdAt',
          {
            unique: false
          }
        )
      } else if (event.oldVersion < 2) {
        const store = event.target.transaction.objectStore(STORE_NAME)
        const cursorRequest = store.openCursor()

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor) return

          const existing = cursor.value
          if (typeof existing.bookmarked !== 'boolean') {
            cursor.update({ ...existing, bookmarked: false })
          }
          cursor.continue()
        }
      }

    }


    request.onsuccess = () => {

      resolve(request.result)

    }


    request.onerror = () => {

      reject(
        request.error
      )

    }

  })

}


// =========================================================
// SAVE PDF
// =========================================================

export const savePDF = async ({
  blob,
  title,
  category = 'Other',
  examName = 'General',
  examId = '',
  sourceUrl = '',
  summaryType = '',
  language = '',
  bookmarked = false
}) => {

  if (!(blob instanceof Blob)) {

    throw new Error(
      'Invalid PDF file.'
    )

  }


  const db =
    await openDatabase()


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE_NAME,
          'readwrite'
        )


      const store =
        transaction.objectStore(
          STORE_NAME
        )

      const id =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`

      const pdfData = {
        id,
        title: title || 'SmartDoc AI Summary',
        category: category || 'Other',
        examName: examName || 'General',
        examId: examId || '',
        sourceUrl: sourceUrl || '',
        summaryType: summaryType || '',
        language: language || '',
        bookmarked,
        createdAt: new Date().toISOString(),
        size: blob.size,
        mimeType: blob.type || 'application/pdf',
        blob
      }

      const request = store.add(pdfData)
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve(pdfData)
      transaction.onabort = () => reject(transaction.error || new Error('Unable to save the PDF in local storage.'))

    }

  )

}


export const updatePDF = async (id, updates) => {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)
    let updatedPDF = null
    let operationError = null

    request.onsuccess = () => {
      if (!request.result) {
        operationError = new Error('The saved PDF could not be found.')
        transaction.abort()
        return
      }

      updatedPDF = { ...request.result, ...updates, id }
      const updateRequest = store.put(updatedPDF)
      updateRequest.onerror = () => { operationError = updateRequest.error }
    }

    request.onerror = () => { operationError = request.error }
    transaction.oncomplete = () => resolve(updatedPDF)
    transaction.onabort = () => reject(operationError || transaction.error || new Error('Unable to update the saved PDF.'))
  })
}


// =========================================================
// GET ALL PDFs
// =========================================================

export const getPDFs = async () => {

  const db =
    await openDatabase()


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE_NAME,
          'readonly'
        )


      const store =
        transaction.objectStore(
          STORE_NAME
        )


      const request =
        store.getAll()


      request.onsuccess =
        () => {

          const pdfs =
            request.result || []


          pdfs.sort(
            (a, b) =>
              new Date(
                b.createdAt
              ) -
              new Date(
                a.createdAt
              )
          )


          resolve(
            pdfs
          )

        }


      request.onerror =
        () => {

          reject(
            request.error
          )

        }

    }

  )

}

export const getAllPDFs = getPDFs;


// =========================================================
// GET ONE PDF
// =========================================================

export const getPDF = async (
  id
) => {

  const db =
    await openDatabase()


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE_NAME,
          'readonly'
        )


      const store =
        transaction.objectStore(
          STORE_NAME
        )


      const request =
        store.get(id)


      request.onsuccess =
        () => {

          resolve(
            request.result || null
          )

        }


      request.onerror =
        () => {

          reject(
            request.error
          )

        }

    }

  )

}


// =========================================================
// DELETE ONE PDF
// =========================================================

export const deletePDF = async (
  id
) => {

  const db =
    await openDatabase()


  return new Promise(
    (resolve, reject) => {

      const transaction =
        db.transaction(
          STORE_NAME,
          'readwrite'
        )


      const store =
        transaction.objectStore(
          STORE_NAME
        )


      const request =
        store.delete(id)


      request.onsuccess =
        () => {

          resolve(
            true
          )

        }


      request.onerror =
        () => {

          reject(
            request.error
          )

        }

    }

  )

}


// =========================================================
// CLEAR ALL PDFs
// =========================================================

export const clearAllPDFs =
  async () => {

    const db =
      await openDatabase()


    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            STORE_NAME,
            'readwrite'
          )


        const store =
          transaction.objectStore(
            STORE_NAME
          )


        const request =
          store.clear()


        request.onsuccess =
          () => {

            resolve(
              true
            )

          }


        request.onerror =
          () => {

            reject(
              request.error
            )

          }

      }

    )

  }


// =========================================================
// PDF SIZE FORMATTER
// =========================================================

export const formatPDFSize =
  (bytes) => {

    if (
      !bytes ||
      bytes <= 0
    ) {

      return '0 KB'

    }


    const kb =
      bytes / 1024


    if (kb < 1024) {

      return `${kb.toFixed(1)} KB`

    }


    const mb =
      kb / 1024


    return `${mb.toFixed(1)} MB`

  }


// =========================================================
// No fixed application-level limit; IndexedDB quota is browser-managed.
// =========================================================

export const getPDFLimit = () => null