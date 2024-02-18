const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const gravatar = require("gravatar");
const fs = require("fs/promises");
const Jimp = require("jimp");
const { nanoid } = require("nanoid");

const { HttpError, ctrlWrapper, sendEmail } = require("../helpers");
const { User } = require("../models/user");

const avatarsDir = path.join(__dirname, "../", "public", "avatars");


const register = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user) {
        throw HttpError(409, "Email is already in use");
    }

  const hashPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email);
  const verificationToken = nanoid();

  const newUser = await User.create({
    ...req.body,
    password: hashPassword,
    avatarURL,
    verificationToken
  });

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="http://localhost:3000/api/users/verify/${verificationToken}"> Click to verify </a>`,
  };
  
  await sendEmail(verifyEmail);

    res.status(201).json({
        user: {
            email: newUser.email,
            subscription: "starter",
        },
    })
};

const login = async (req, res) => { 
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });

    if (!user) {
        throw HttpError(401, "Email or password wrong");
  };

  if (!user.verify) {
    throw HttpError(404, "User not found");
  }

    const passwordCompare = await bcrypt.compare(password, user.password);
    
    if (!passwordCompare) {
        throw HttpError(401, "Email or password wrong");
    };

    const payload = {
        id: user._id,
    }

    const { SECRET_KEY } = process.env;

    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });
    await User.findByIdAndUpdate(user._id, { token });
    
    res.status(201).json({
        token,
         user: {
    email: user.email,
    subscription: user.subscription,
  }
    });
}

const getCurrent = async (req, res) => { 
    const { email, subscription } = req.user;
    res.json(
        {email,
        subscription}
    )
}

const logout = async (req, res) => {
    const { _id } = req.user;
    const user = await User.findByIdAndUpdate(_id, { token: "" });
    console.log(user);
  
    res.status(204).end()
}


const updateAvatar = async (req, res) => {
    const { _id } = req.user;
  if (!req.file) {
    throw HttpError(400, "Please add image for avatar");
  } else {
      const { path: tempUpload, originalname } = req.file;
      const filename = `${_id}_${originalname}`;
      const resultUpload = path.join(avatarsDir, filename);

    await fs.rename(tempUpload, resultUpload);

    Jimp.read(resultUpload, (err, image) => {
        if (err) { throw err }; 
      image.resize(250, 250).write(resultUpload);
    });

    const avatarURL = path.join("avatars", filename);

    await User.findByIdAndUpdate(_id, { avatarURL });

    res.status(200).json({
      avatarURL,
    });
  }

};




const verifyEmail = async (req, res) => {
  const { verificationToken } = req.params;
  console.log(verificationToken);
  const user = await User.findOne({ verificationToken });
  if (!user) {
    throw HttpError(404, "User not found");
  }
  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationToken: null,
  });
  res.json({ message: "Verification successful" });
};



const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(400, "missing required field email");
  }
  if (user.verify) {
    throw HttpError(400, "Verification has already been passed");
  }
  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="http://localhost:3000/api/users/verify/${user.verificationToken}"> Click to verify </a>`,
  };
  await sendEmail(verifyEmail);
  res.status(201).json({
    message: "Verification email sent",
  });
};



module.exports = {
    register: ctrlWrapper(register),
    login: ctrlWrapper(login),
    getCurrent: ctrlWrapper(getCurrent),
    logout: ctrlWrapper(logout),
  updateAvatar: ctrlWrapper(updateAvatar),
  verifyEmail: ctrlWrapper(verifyEmail),
  resendVerifyEmail: ctrlWrapper(resendVerifyEmail),
}