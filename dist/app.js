"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./config/database");
const routes_1 = __importDefault(require("./routes/routes"));
const stripeController_1 = require("./controllers/stripeController");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: 'http://localhost:5173',
    credentials: true
}));
// Middleware pour parser JSON
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'uploads')));
app.post("/webhook", express_1.default.raw({ type: "application/json" }), stripeController_1.handleStripeWebhook);
// Routes principales
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', routes_1.default);
// Tester la connexion à la DB au démarrage
database_1.database.connect()
    .then(() => console.log('✅ Connexion à PostgreSQL réussie'))
    .catch((err) => console.error('❌ Erreur de connexion à PostgreSQL :', err));
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
