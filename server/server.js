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
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Connexion SQLite
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Erreur connexion DB:', err);
  } else {
    console.log('✅ Connecté à SQLite');
    initDatabase();
  }
});

// Initialisation des tables
function initDatabase() {
  // Créer les tables en séquence avec serialize pour garantir l'ordre
  db.serialize(() => {
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

    db.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE
    )`, (err) => {
      if (err) {
        console.error('Erreur création table utilisateurs:', err);
        return;
      }

      // Insertion utilisateurs par défaut APRÈS création de la table
      const utilisateursDefaut = [
        'Farid', 'Elias', 'Younes', 
        'Noa', 'Maxence', 'Alexis',
        'Gab', 'Monel'
      ];

      utilisateursDefaut.forEach(nom => {
        db.run('INSERT OR IGNORE INTO utilisateurs (nom) VALUES (?)', [nom], (err) => {
          if (err) console.error('Erreur insertion utilisateur:', err);
        });
      });

      console.log('✅ Tables et utilisateurs initialisés');
    });
  });
}

// ========== ROUTES PIECES ==========

// Récupérer toutes les pièces
app.get('/api/pieces', (req, res) => {
  db.all('SELECT * FROM pieces', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Récupérer une pièce par référence
app.get('/api/pieces/:reference', (req, res) => {
  db.get('SELECT * FROM pieces WHERE reference = ?', [req.params.reference], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Pièce non trouvée' });
    } else {
      res.json(row);
    }
  });
});

// Créer une nouvelle pièce
app.post('/api/pieces', (req, res) => {
  const { reference, nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo } = req.body;
  
  db.run(
    'INSERT INTO pieces (reference, nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [reference, nom, categorie, quantite_stock || 0, quantite_min || 0, localisation, fournisseur, photo],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ reference, message: 'Pièce créée avec succès' });
      }
    }
  );
});

// Modifier une pièce
app.put('/api/pieces/:reference', (req, res) => {
  const { nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo } = req.body;
  
  db.run(
    'UPDATE pieces SET nom = ?, categorie = ?, quantite_stock = ?, quantite_min = ?, localisation = ?, fournisseur = ?, photo = ? WHERE reference = ?',
    [nom, categorie, quantite_stock, quantite_min, localisation, fournisseur, photo, req.params.reference],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Pièce non trouvée' });
      } else {
        res.json({ message: 'Pièce mise à jour' });
      }
    }
  );
});

// Supprimer une pièce
app.delete('/api/pieces/:reference', (req, res) => {
  db.run('DELETE FROM pieces WHERE reference = ?', [req.params.reference], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Pièce non trouvée' });
    } else {
      res.json({ message: 'Pièce supprimée' });
    }
  });
});

// ========== ROUTES MOUVEMENTS ==========

// Récupérer tous les mouvements
app.get('/api/mouvements', (req, res) => {
  db.all(
    `SELECT m.*, p.nom as nom_piece 
     FROM mouvements m 
     LEFT JOIN pieces p ON m.reference_piece = p.reference 
     ORDER BY m.date_heure DESC`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// Récupérer mouvements par pièce
app.get('/api/mouvements/piece/:reference', (req, res) => {
  db.all(
    'SELECT * FROM mouvements WHERE reference_piece = ? ORDER BY date_heure DESC',
    [req.params.reference],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// Créer un mouvement (entrée ou sortie)
app.post('/api/mouvements', (req, res) => {
  const { reference_piece, type_mouvement, quantite, utilisateur, machine_intervention, commentaire } = req.body;
  const date_heure = new Date().toISOString();

  // Validation
  if (!['Entrée', 'Sortie'].includes(type_mouvement)) {
    return res.status(400).json({ error: 'Type de mouvement invalide' });
  }

  // Vérifier stock suffisant pour sortie
  if (type_mouvement === 'Sortie') {
    db.get('SELECT quantite_stock FROM pieces WHERE reference = ?', [reference_piece], (err, piece) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!piece) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }
      if (piece.quantite_stock < quantite) {
        return res.status(400).json({ error: 'Stock insuffisant' });
      }
      
      enregistrerMouvement();
    });
  } else {
    enregistrerMouvement();
  }

  function enregistrerMouvement() {
    db.run(
      'INSERT INTO mouvements (reference_piece, type_mouvement, quantite, date_heure, utilisateur, machine_intervention, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [reference_piece, type_mouvement, quantite, date_heure, utilisateur, machine_intervention, commentaire],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Mettre à jour le stock
        const operation = type_mouvement === 'Entrée' ? '+' : '-';
        db.run(
          `UPDATE pieces SET quantite_stock = quantite_stock ${operation} ? WHERE reference = ?`,
          [quantite, reference_piece],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, message: 'Mouvement enregistré' });
          }
        );
      }
    );
  }
});

// ========== ROUTES UTILISATEURS ==========

// Récupérer tous les utilisateurs
app.get('/api/utilisateurs', (req, res) => {
  db.all('SELECT * FROM utilisateurs ORDER BY nom', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// ========== ROUTES STATISTIQUES ==========

// Pièces en alerte stock
app.get('/api/alertes', (req, res) => {
  db.all(
    'SELECT * FROM pieces WHERE quantite_stock <= quantite_min',
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({ url: `/uploads/${req.file.filename}` });
  } else {
    res.status(400).json({ error: 'Pas de fichier uploadé' });
  }
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});