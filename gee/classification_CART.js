/*
---------------------------------------------------------
Land Cover Classification using Google Earth Engine
Study Area : Thiès Nord, Senegal

Satellite:
Sentinel-2 Surface Reflectance

Classifier:
CART (Classification and Regression Tree)

Spectral Bands:
B2, B3, B4, B8, B11, B12

Author:
Ibrahima Mbemba Diatta

Year:
2024
---------------------------------------------------------
*/

// ================================
// Spectral bands
// ================================
var bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];

print('Selected bands:', bands);

// ================================
// Load Sentinel-2 imagery
// ================================
var imageCollection = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(Thies)
    .filterDate('2023-05-01', '2023-09-30')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .select(bands)
    .median();

// Clip to study area
var imageThies = imageCollection.clip(Thies);

// Display Sentinel-2 image
Map.centerObject(Thies, 11);

Map.addLayer(imageThies,
{
  bands:['B4','B3','B2'],
  min:0,
  max:3000
},
'Sentinel-2');

// ================================
// Merge training samples
// ================================

var trainingSamples = vegetation
      .merge(solnu)
      .merge(Bati)
      .merge(solarg)
      .merge(beton)
      .merge(routes);

print('Training Samples',trainingSamples);

Map.addLayer(trainingSamples,{},'Training Samples');

// ================================
// Split data (70% training / 30% validation)
// ================================

var samples = trainingSamples.randomColumn('random');

var trainingSet = samples.filter(
    ee.Filter.lt('random',0.7));

var validationSet = samples.filter(
    ee.Filter.gte('random',0.7));

print('Training points',trainingSet.size());
print('Validation points',validationSet.size());

// ================================
// Extract spectral information
// ================================

var training = imageThies.sampleRegions({

    collection:trainingSet,
    properties:['trainingSamples'],
    scale:10

});

print(training);

// ================================
// Train CART classifier
// ================================

var classifier = ee.Classifier.smileCart();

var trainedClassifier = classifier.train({

    features:training,
    classProperty:'trainingSamples',
    inputProperties:bands

});

print(trainedClassifier.explain());

// ================================
// Classify image
// ================================

var classified = imageThies.classify(trainedClassifier);

// ================================
// Display classification
// ================================

Map.addLayer(classified,
{
    min:1,
    max:6,
    palette:[
        '008000', // Vegetation
        'A0522D', // Bare soil
        '0000FF', // Buildings
        'FFFF00', // Agricultural soil
        '808080', // Concrete
        'FF6600'  // Roads
    ]
},
'CART Classification');

// ================================
// Validation
// ================================

var validation = imageThies.sampleRegions({

    collection:validationSet,
    properties:['trainingSamples'],
    scale:10

});

var validated = validation.classify(trainedClassifier);

// ================================
// Confusion Matrix
// ================================

var confusionMatrix = validated.errorMatrix(
    'trainingSamples',
    'classification'
);

print('Confusion Matrix', confusionMatrix);

// ================================
// Accuracy Assessment
// ================================

print('Overall Accuracy',
      confusionMatrix.accuracy());

print('Kappa Coefficient',
      confusionMatrix.kappa());

print('Producer Accuracy',
      confusionMatrix.producersAccuracy());

print('User Accuracy',
      confusionMatrix.consumersAccuracy());

// ================================
// Export classified image
// ================================

Export.image.toDrive({

    image: classified,

    description:'Classification_CART_Thies',

    folder:'GEE',

    fileFormat:'GeoTIFF',

    region:Thies,

    scale:10,

    maxPixels:1e13,

    crs:'EPSG:32628'

});

// ================================
// Export validation samples
// ================================

Export.table.toDrive({

    collection:validated,

    description:'Validation_CART',

    folder:'GEE',

    fileFormat:'CSV'

});