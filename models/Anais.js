const connection = require("../connection.js")

class Anais {
  static async create({ title, authors, category, year, pdf_url, description, event_name, status }) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO Anais (title, authors, category, year, pdf_url, description, event_name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `

      const values = [
        title,
        JSON.stringify(authors),
        category,
        year,
        pdf_url,
        description || null,
        event_name || null,
        status || "active",
      ]

      connection.query(query, values, (err, result) => {
        if (err) return reject(err)

        // Buscar o registro recém-criado
        connection.query("SELECT * FROM Anais WHERE id = ?", [result.insertId], (err, rows) => {
          if (err) return reject(err)
          const anais = rows[0]
          anais.authors = typeof anais.authors === "string" ? JSON.parse(anais.authors) : anais.authors
          resolve(anais)
        })
      })
    })
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM Anais
        WHERE status != 'deleted'
      `
      const values = []

      if (filters.category && filters.category !== "Todos") {
        query += ` AND category = ?`
        values.push(filters.category)
      }

      if (filters.year && filters.year !== "Todos") {
        query += ` AND year = ?`
        values.push(filters.year)
      }

      if (filters.search) {
        query += ` AND (title LIKE ? OR authors LIKE ?)`
        values.push(`%${filters.search}%`, `%${filters.search}%`)
      }

      query += ` ORDER BY year DESC, created_at DESC`

      connection.query(query, values, (err, rows) => {
        if (err) return reject(err)

        // Parse authors JSON string back to array
        const result = rows.map((row) => ({
          ...row,
          authors: typeof row.authors === "string" ? JSON.parse(row.authors) : row.authors,
        }))

        resolve(result)
      })
    })
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = "SELECT * FROM Anais WHERE id = ? AND status != 'deleted'"

      connection.query(query, [id], (err, rows) => {
        if (err) return reject(err)
        if (rows.length === 0) return resolve(null)

        const row = rows[0]
        const anais = {
          ...row,
          authors: typeof row.authors === "string" ? JSON.parse(row.authors) : row.authors,
        }
        resolve(anais)
      })
    })
  }

  static async update(id, { title, authors, category, year, pdf_url, description, event_name, status }) {
    return new Promise((resolve, reject) => {
      // Construir a query dinamicamente com apenas os campos fornecidos
      const updates = []
      const values = []

      if (title !== undefined) {
        updates.push("title = ?")
        values.push(title)
      }
      if (authors !== undefined) {
        updates.push("authors = ?")
        values.push(JSON.stringify(authors))
      }
      if (category !== undefined) {
        updates.push("category = ?")
        values.push(category)
      }
      if (year !== undefined) {
        updates.push("year = ?")
        values.push(year)
      }
      if (pdf_url !== undefined) {
        updates.push("pdf_url = ?")
        values.push(pdf_url)
      }
      if (description !== undefined) {
        updates.push("description = ?")
        values.push(description)
      }
      if (event_name !== undefined) {
        updates.push("event_name = ?")
        values.push(event_name)
      }
      if (status !== undefined) {
        updates.push("status = ?")
        values.push(status)
      }

      // Se nenhum campo foi fornecido, retornar o registro atual
      if (updates.length === 0) {
        connection.query("SELECT * FROM Anais WHERE id = ?", [id], (err, rows) => {
          if (err) return reject(err)
          if (rows.length === 0) return resolve(null)
          const anais = rows[0]
          anais.authors = typeof anais.authors === "string" ? JSON.parse(anais.authors) : anais.authors
          resolve(anais)
        })
        return
      }

      // Adicionar updated_at sem placeholder (função NOW()) e depois adicionar id para o WHERE
      updates.push("updated_at = NOW()")
      values.push(id) // Este é o último valor - para o WHERE id = ?

      const query = `
        UPDATE Anais
        SET ${updates.join(", ")}
        WHERE id = ?
      `

      console.log("[v0] UPDATE QUERY:", query)
      console.log("[v0] UPDATE VALUES:", JSON.stringify(values))

      connection.query(query, values, (err, result) => {
        if (err) {
          console.error("[v0] UPDATE ERROR:", err)
          return reject(err)
        }
        console.log("[v0] UPDATE RESULT:", result)
        
        // Se houver warnings, logar eles
        if (result.warningCount > 0) {
          connection.query("SHOW WARNINGS", (wErr, warnings) => {
            if (!wErr) console.log("[v0] MySQL WARNINGS:", JSON.stringify(warnings, null, 2))
          })
        }
        
        if (result.affectedRows === 0) return resolve(null)

        // Buscar o registro atualizado
        connection.query("SELECT * FROM Anais WHERE id = ?", [id], (err, rows) => {
          if (err) return reject(err)
          if (rows.length === 0) return resolve(null)
          const anais = rows[0]
          console.log("[v0] UPDATED RECORD FROM DB:", JSON.stringify(anais))
          anais.authors = typeof anais.authors === "string" ? JSON.parse(anais.authors) : anais.authors
          resolve(anais)
        })
      })
    })
  }

  static async archive(id) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE Anais
        SET status = 'archived', updated_at = NOW()
        WHERE id = ?
      `

      connection.query(query, [id], (err, result) => {
        if (err) return reject(err)

        connection.query("SELECT * FROM Anais WHERE id = ?", [id], (err, rows) => {
          if (err) return reject(err)
          resolve(rows[0])
        })
      })
    })
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      const query = "DELETE FROM Anais WHERE id = ?"

      connection.query(query, [id], (err, result) => {
        if (err) return reject(err)
        resolve({ affectedRows: result.affectedRows })
      })
    })
  }

  static async getStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN year = YEAR(CURDATE()) THEN 1 END) as this_year,
          COUNT(DISTINCT category) as categories_count,
          COUNT(DISTINCT year) as years_count
        FROM Anais
        WHERE status != 'deleted'
      `

      connection.query(query, (err, rows) => {
        if (err) return reject(err)
        resolve(rows[0])
      })
    })
  }
}

module.exports = Anais
