const express = require('express');

const { validateBody, authentificate, upload } = require("../../middlewares");
const { schemas } = require("../../models/user");

const ctrl = require("../../controllers/auth");

const router = express.Router();



router.post("/register", validateBody(schemas.joiUserSchema), ctrl.register);
router.post("/login", validateBody(schemas.joiUserSchema), ctrl.login);
router.get("/current", authentificate, ctrl.getCurrent);
router.post("/logout", authentificate, ctrl.logout);


router.patch("/avatars", authentificate, upload.single("avatar"), ctrl.updateAvatar)




module.exports = router