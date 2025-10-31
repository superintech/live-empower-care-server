const express = require('express');
const router = express.Router();
const { 
  uploadModules, 
  getModuleFields, 
  getAllModules, 
  deleteModule,
  renameModule,
  updateModuleOrder,
  uploadSearchData,
  getSearchData,
  searchData,
  deleteSearchData
} = require('../controllers/uploadModules');

// Existing routes
router.post('/saveFields', uploadModules);
router.get('/getFields/:moduleName', getModuleFields);
router.get('/getAllModules', getAllModules);
router.delete('/deleteModule/:moduleName', deleteModule);
router.put('/renameModule', renameModule);
router.put('/updateModuleOrder', updateModuleOrder);

// New search data routes
router.post('/uploadSearchData', uploadSearchData);
router.get('/getSearchData/:moduleName/:fieldIndex', getSearchData);
router.get('/searchData/:moduleName/:fieldIndex', searchData);
router.delete('/deleteSearchData/:moduleName/:fieldIndex', deleteSearchData);

module.exports = router;