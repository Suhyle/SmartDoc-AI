// =========================================================
// SmartDoc AI - Local PDF Storage
// =========================================================

const DB_NAME = 'SmartDocAI_DB'
const DB_VERSION = 1
const STORE_NAME = 'pdfs'

const MAX_PDFS = 10


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
  sourceUrl = '',
  summaryType = '',
  language = ''
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


      const countRequest =
        store.count()


      countRequest.onsuccess =
        () => {

          const count =
            countRequest.result


          if (
            count >= MAX_PDFS
          ) {

            reject(
              new Error(
                `Downloads limit reached. You can store a maximum of ${MAX_PDFS} PDFs. Please delete an existing PDF first.`
              )
            )

            return

          }


          const id =
            `${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`


          const pdfData = {

            id,

            title:
              title ||
              'SmartDoc AI Summary',

            category:
              category ||
              'Other',

            sourceUrl:
              sourceUrl ||
              '',

            summaryType:
              summaryType ||
              '',

            language:
              language ||
              '',

            createdAt:
              new Date().toISOString(),

            size:
              blob.size,

            mimeType:
              blob.type ||
              'application/pdf',

            blob

          }


          const request =
            store.add(
              pdfData
            )


          request.onsuccess =
            () => {

              resolve(
                pdfData
              )

            }


          request.onerror =
            () => {

              reject(
                request.error
              )

            }

        }


      countRequest.onerror =
        () => {

          reject(
            countRequest.error
          )

        }

    }

  )

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
// MAXIMUM STORAGE LIMIT
// =========================================================

export const getPDFLimit =
  () => {

    return MAX_PDFS

  }