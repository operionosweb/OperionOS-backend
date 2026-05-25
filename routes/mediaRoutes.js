@operionosweb ➜ /workspaces/OperionOS-backend (main) $ grep -r "cloudinary" .
./routes/mediaRoutes.js:import { CloudinaryStorage } from "multer-storage-cloudinary";
./routes/mediaRoutes.js:import cloudinary from "../config/cloudinary.js";
./routes/mediaRoutes.js:  cloudinary,
./routes/mediaRoutes.js:      await cloudinary.uploader.destroy(publicId);
./config/cloudinary.js:import { v2 as cloudinary } from "cloudinary";
./config/cloudinary.js:cloudinary.config({
./config/cloudinary.js:export default cloudinary;
grep: ./.git/index: binary file matches
@operionosweb ➜ /workspaces/OperionOS-backend (main) $ 
