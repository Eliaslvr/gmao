const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Configuration multer pour upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Connexion SQLite
const db = new sqlite3.Database('./database.db', err => {
  if (err) {
    console.error('Erreur connexion DB:', err);
  } else {
    console.log('✅ Connecté à SQLite');
    initDatabase();
  }
});

// Initialisation des tables
function initDatabase() {
  db.serialize(() => {
    // Table pièces
    db.run(`CREATE TABLE IF NOT EXISTS pieces (
      reference TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      categorie TEXT NOT NULL,
      quantite_stock INTEGER DEFAULT 0,
      quantite_min INTEGER DEFAULT 0,
      localisation TEXT,
      fournisseur TEXT,
      photo TEXT
    )`);

    // Table mouvements
    db.run(`CREATE TABLE IF NOT EXISTS mouvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_piece TEXT NOT NULL,
      type_mouvement TEXT NOT NULL,
      quantite INTEGER NOT NULL,
      date_heure TEXT NOT NULL,
      utilisateur TEXT NOT NULL,
      machine_intervention TEXT,
      commentaire TEXT,
      FOREIGN KEY (reference_piece) REFERENCES pieces(reference)
    )`);

    // Table utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    )`, err => {
      if (err) {
        console.error('Erreur création table utilisateurs:', err);
        return;
      }

      // 🔄 Réinitialiser les utilisateurs
      const utilisateursDefaut = [
        'Farid', 'Elias', 'Younes', 
        'Noa', 'Maxence', 'Alexis',
        'Gab', 'Monel'
      ];

      // Supprime tous les utilisateurs existants puis ajoute les nouveaux
      db.run('DELETE FROM utilisateurs', [], err => {
        if (err) {
          console.error('Erreur suppression utilisateurs:', err);
        } else {
          utilisateursDefaut.forEach(nom => {
            db.run('INSERT INTO utilisateurs (nom) VALUES (?)', [nom], err => {
              if (err) console.error('Erreur insertion utilisateur:', err);
            });
          });
          console.log('✅ Utilisateurs réinitialisés');
        }
      });
    });

    console.log('✅ Tables initialisées');
  });
}

// --------------------- ROUTES ---------------------

// Pièces
app.get('/api/pieces', (req, res) => {
  db.all('SELECT * FROM pieces', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/pieces/:reference', (req, res) => {
  db.get('SELECT * FROM pieces WHERE reference = ?', [req.params.reference], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Pièce non trouvée' });
    res.json(row);
  });
});

app.post('/api/pieces', (req, res) => {
  const { reference, nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo } = req.body;
  db.run(
    'INSERT INTO pieces (reference, nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [reference, nom, categorie, quantite_stock || 0, quantite_min || 0, localisation, fournisseur, photo],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ reference, message: 'Pièce créée avec succès' });
    }
  );
});

app.put('/api/pieces/:reference', (req, res) => {
  const { nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo } = req.body;
  db.run(
    'UPDATE pieces SET nom=?, categorie=?, quantite_stock=?, quantite_min=?, localisation=?, fournisseur=?, photo=? WHERE reference=?',
    [nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo, req.params.reference],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Pièce non trouvée' });
      res.json({ message: 'Pièce mise à jour' });
    }
  );
});

app.delete('/api/pieces/:reference', (req, res) => {
  db.run('DELETE FROM pieces WHERE reference = ?', [req.params.reference], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Pièce non trouvée' });
    res.json({ message: 'Pièce supprimée' });
  });
});

// Mouvements
app.get('/api/mouvements', (req, res) => {
  db.all(`SELECT m.*, p.nom as nom_piece FROM mouvements m LEFT JOIN pieces p ON m.reference_piece=p.reference ORDER BY m.date_heure DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/mouvements/piece/:reference', (req, res) => {
  db.all('SELECT * FROM mouvements WHERE reference_piece=? ORDER BY date_heure DESC', [req.params.reference], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/mouvements', (req, res) => {
  const { reference_piece, type_mouvement, quantite, utilisateur, machine_intervention, commentaire } = req.body;
  const date_heure = new Date().toISOString();

  if (!['Entrée','Sortie'].includes(type_mouvement))
    return res.status(400).json({ error: 'Type de mouvement invalide' });

  const enregistrer = () => {
    db.run(
      'INSERT INTO mouvements (reference_piece, type_mouvement, quantite, date_heure, utilisateur, machine_intervention, commentaire) VALUES (?,?,?,?,?,?,?)',
      [reference_piece, type_mouvement, quantite, date_heure, utilisateur, machine_intervention, commentaire],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const op = type_mouvement === 'Entrée' ? '+' : '-';
        db.run(`UPDATE pieces SET quantite_stock = quantite_stock ${op} ? WHERE reference=?`, [quantite, reference_piece], err => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, message: 'Mouvement enregistré' });
        });
      }
    );
  };

  if (type_mouvement === 'Sortie') {
    db.get('SELECT quantite_stock FROM pieces WHERE reference=?', [reference_piece], (err, piece) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!piece) return res.status(404).json({ error: 'Pièce non trouvée' });
      if (piece.quantite_stock < quantite) return res.status(400).json({ error: 'Stock insuffisant' });
      enregistrer();
    });
  } else enregistrer();
});

// Utilisateurs
app.get('/api/utilisateurs', (req, res) => {
  db.all('SELECT * FROM utilisateurs ORDER BY nom', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Alertes stock
app.get('/api/alertes', (req, res) => {
  db.all('SELECT * FROM pieces WHERE quantite_stock <= quantite_min', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (req.file) res.json({ url: `/uploads/${req.file.filename}` });
  else res.status(400).json({ error: 'Pas de fichier uploadé' });
});

// Serveur
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));
