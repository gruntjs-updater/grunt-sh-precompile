/*
 * grunt-sh-precompile
 *
 *
 * Copyright (c) 2014 jack chen
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('sh_precompile', 'Pre compile DUST template, and this is not a generic grunt plugin', function() {
         // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
                commonPropsSrc: ['common/**/*.properties'],
                scriptsPropsSrc: ['scripts/**/*.properties'],
                scriptsPropsFileName: 'i18nPropsForScripts'
            }),
            filesSrc = this.filesSrc,
            i18nRegExp = /\{@i18n\s+?key=["](.+?)["]\s*?\/}/gmi,
            dustRegExp = /\.dust$/,
            path = require('path'),
            sep = path.sep,
            eol = require('os').EOL,
            fs = require('fs'),
            _ = require('underscore'),
            parser = require('properties-parser'), // Please refer to https://github.com/xavi-/node-properties-parser
            i18nPropsForScriptsTemplateFile = '../i18nPropsForScripts.tpl',
            itself = this,
            util = {};

        util = {
            // locales list is an array containing normalized Country-lang code list, e.g. ['de-de', 'en-us', 'en-gb'];
            localesList: [],
            // templates list is an array containing all of dust for each locale, e.g. ['build-dev/resources/shape/locales/de-de/templates/home.dust','build-dev/resources/shape/locales/en-gb/templates/home.dust','build-dev/resources/shape/locales/en-us/templates/home.dust','build-dev/resources/shape/locales/de-de/templates/header.dust',...];
            templatesList: [],
            // common properties JSON list contains the locale - commonPropsJson, e.g. [{'de-de': {'k1':'v1', 'k2':'v2'}}, {'en-gb': {'k1':'v1gb', 'k2':'v2gb'}}]
            commonPropsJsonList: [],
            // scripts properties JSON list contains the locale - scriptsPropsJson, similar with the variable commonPropsJsonList
            scriptsPropsJsonList: [],
            // locales root path in deployment folder
            localesRootPath: '',

            getLocalesRootPath: function() {
                return this.localesRootPath;
            },

            setLocalesRootPath: function(filepath) {
                this.localesRootPath = filepath;
            },

            getLocalesList: function() {
                // This will return the reference to the localesList, so any modification to this returned object will reflect to the original localesList
                // the same rule also apply to the templatesList, commonPropsJsonList and scriptsPropsJsonList
                return this.localesList;
            },

            setLocalesList: function(list) {
                this.localesList = list;
            },

            getTemplatesList: function() {
                return this.templatesList;
            },

            setTemplatesList: function(list) {
                this.templatesList = list;
            },

            getCommonPropsJsonList: function() {
                return this.commonPropsJsonList;
            },

            setCommonPropsJsonList: function(list) {
                this.commonPropsJsonList = list;
            },

            getScriptsPropsJsonList: function() {
                return this.scriptsPropsJsonList;
            },

            setScriptsPropsJsonList: function(list) {
                this.scriptsPropsJsonList = list;
            },

            endsWith: function(str, suffix) {
                return str.substring(str.length - suffix.length, str.length) === suffix;
            },

            isEmpty: function(val) {
                return (typeof val === 'undefined') || val === null;
            },

            createSpace: function(num) {
                // Default create 4 spaces
                num = (num || 4) + 1;
                return new Array(num).join(' ');
            },

            convertJson: function(json) {
                var obj = {},
                    _this = this;

                _.each(json, function(val, key) {
                    obj[key] = _this._convertStringIfBooleanOrNumber(val);
                });

                return obj;
            },

            _convertStringIfBooleanOrNumber: function(original) {
                if (original && _.isString(original)) {
                    if (original === 'true') {
                        return true;
                    }
                    if (original === 'false') {
                        return false;
                    }
                    try {
                        if (this._isNumeric(original)) {
                            return parseFloat(original);
                        }
                        return original;
                    }
                    catch (e) {
                        return original;
                    }
                }
                else {
                    return original;
                }
            },

            // http://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
            // http://rosettacode.org/wiki/Determine_if_a_string_is_numeric#JavaScript
            _isNumeric: function(n) {
                return !isNaN(parseFloat(n)) && isFinite(n);
            },

            getLocaleFromFilePath: function(filePath) {
                var locale = '';

                filePath = path.normalize(filePath);
                locale = _.find(this.localesList, function(val) {
                    return filePath.indexOf(sep + val + sep) > 0;
                });

                return locale;
            },

            getNormalizedLocale: function(locale) {
                return !!locale ? locale : this.getDefaultLocale();
            },

            getDefaultLocale: function() {
                return 'en-us';
            },

            // To get all of the available locales list, commonPropsJsonList, scriptsPropsJsonList
            init: function(options) {
                var _this = this,
                    scriptsPropsSrc = options.scriptsPropsSrc,
                    commonPropsSrc = options.commonPropsSrc,
                    implementedLocalesList = options.implementedLocalesList,
                    keyPrefix = options.keyPrefix,
                    localesRootPath = this.getLocalesRootPath(),
                    localesList = this.getLocalesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList(),
                    scriptsPropsJsonList = this.getScriptsPropsJsonList();

                // Fetch all the actually implemented locales list
                fs.readdirSync(localesRootPath).forEach(function(locale) {
                    locale = _this.getNormalizedLocale(locale);
                    locale = locale.toLowerCase();

                    if (_.contains(implementedLocalesList, locale)) {
                        localesList.push(locale);
                    }

                });

                _.each(localesList, function(locale) {
                    var commonLocalePropsSrc = [],
                        commonPropsFileArr = [],
                        commonLocalePropsJson = {},
                        commonPropsJson = {},
                        scriptsLocalePropsSrc = [],
                        scriptsPropsFileArr = [],
                        scriptsLocalePropsJson = {},
                        scriptsPropsJson = {};

                    /*
                    ** constructure the commonPropsJsonList for each locale
                    */
                    // Re-constructure the commonPropsSrc, actually this is an array, but we need to re-build the common properties file pattern
                    // Since by default, all file paths are relative to the `Gruntfile`, please have a reference:
                    // http://gruntjs.com/api/grunt.file#grunt.file.setbase and http://gruntjs.com/api/grunt.file#grunt.file.expand
                    commonLocalePropsSrc = commonPropsSrc.map(function(commonPropsFilePattern) {
                        return path.join(localesRootPath, locale, commonPropsFilePattern);
                    });

                    commonPropsFileArr = grunt.file.expand(commonLocalePropsSrc);

                    commonPropsFileArr.forEach(function(file) {
                        var jsonObj = grunt.file.exists(file) ? parser.read(file) : {};

                        // Validate whether the key in the common properties file conform to the constraints
                        if (keyPrefix) {
                            _this.validatePropsKey(options, {
                                json: jsonObj,
                                file: file
                            });
                        }

                        jsonObj = _this.convertJson(jsonObj);
                        commonLocalePropsJson = _.extend({}, commonLocalePropsJson, jsonObj);
                    });

                    commonPropsJson[locale] = commonLocalePropsJson;
                    commonPropsJsonList.push(commonPropsJson);

                    // logic to handle the scripts properties file, generate a combiled properties file for each locale
                    // then convert it to a JS file conform to the require js syntax
                    scriptsLocalePropsSrc = scriptsPropsSrc.map(function(scriptsPropsFilePattern) {
                        return path.join(localesRootPath, locale, scriptsPropsFilePattern);
                    });

                    scriptsPropsFileArr = grunt.file.expand(scriptsLocalePropsSrc);

                    scriptsPropsFileArr.forEach(function(file) {
                        var jsonObj = grunt.file.exists(file) ? parser.read(file) : {};

                        // Validate whether the key in the script properties file conform to the constraints
                        if (keyPrefix) {
                            _this.validatePropsKey(options, {
                                json: jsonObj,
                                file: file
                            });
                        }

                        jsonObj = _this.convertJson(jsonObj);
                        scriptsLocalePropsJson = _.extend({}, scriptsLocalePropsJson, jsonObj);
                    });

                    scriptsPropsJson[locale] = scriptsLocalePropsJson;
                    scriptsPropsJsonList.push(scriptsPropsJson);
                });

                grunt.log.writeln(('[precompile] ==== available locale list is: ').bold.blue, localesList);
                grunt.log.writeln(('[precompile] ==== commonPropsJsonList is: ').bold.blue, commonPropsJsonList);
                grunt.log.writeln(('[precompile] ==== scriptsPropsJsonList is: ').bold.blue, scriptsPropsJsonList);

            },
            // Combile commonPropsJson with scriptsPropsJson to generate a new sripts properties for each locale
            generateScriptsProps: function(options) {

                var scriptsPropsFileName = options.scriptsPropsFileName;
                var i18nPropsConfig = options.i18nPropsConfig || {};
                var i18nPropsId = i18nPropsConfig.i18nPropsId;
                var i18nPropsDeps = i18nPropsConfig.i18nPropsDeps || [];
                var i18nPropsDef = '';
                var localesList = this.getLocalesList();
                var commonPropsJsonList = this.getCommonPropsJsonList();
                var scriptsPropsJsonList = this.getScriptsPropsJsonList();
                var getScriptsPropsFilePath = options.getScriptsPropsFilePath;
                var _this = this;

                localesList.forEach(function(locale) {
                    var commonPropsJson = {},
                        scriptsPropsJson = {},
                        content = '',
                        destPath = '';

                    destPath = getScriptsPropsFilePath({
                        locale: locale,
                        scriptsPropsFileName: scriptsPropsFileName,
                        task: itself
                    });

                    _.some(commonPropsJsonList, function(obj) {
                        if (obj[locale]) {
                            commonPropsJson = obj[locale];
                            return true;
                        }
                    });

                    _.some(scriptsPropsJsonList, function(obj) {
                        if (obj[locale]) {
                            scriptsPropsJson = obj[locale];
                            return true;
                        }
                    });

                    scriptsPropsJson = _.extend({}, commonPropsJson, scriptsPropsJson);

                    grunt.verbose.subhead('[precompile] **** scriptsPropsJson', scriptsPropsJson);

                    content = grunt.file.read(path.join(__dirname, i18nPropsForScriptsTemplateFile));

                    // replace the {{i18nPropsDef}} with real i18n props module definition
                    if (i18nPropsId) {
                        i18nPropsDef = "'" + i18nPropsId + "', " + JSON.stringify(i18nPropsDeps) + ', ';
                    }
                    else {
                        i18nPropsDef = '';
                    }

                    content = content.replace('{{i18nPropsDef}}', i18nPropsDef);

                    // Pretty print the JSON file format
                    scriptsPropsJson = JSON.stringify(scriptsPropsJson, null, 4);
                    scriptsPropsJson = scriptsPropsJson.replace(new RegExp(eol + _this.createSpace(4), 'mg'), eol + _this.createSpace(8));
                    scriptsPropsJson = scriptsPropsJson.replace('}', _this.createSpace(4) + '}');

                    content = content.replace('{{i18nPropsJson}}', scriptsPropsJson);

                    grunt.file.write(destPath, content);

                });
            },
            // Copy all the source dust template files to each targeted locale folder.
            copyTemplateFiles: function(options) {

                var localesList = this.getLocalesList(),
                    templatesList = this.getTemplatesList(),
                    getTemplateFilePath = options.getTemplateFilePath;

                filesSrc.forEach(function(srcpath) {
                    // this code line: srcpath = path.normalize(srcpath)
                    // fix the issue on Windows Platform, since on windows git bash, the srcpath and sep value will be like below
                    //
                    // srcpath:  app/templates/footer.dust
                    // sep    :  \
                    //
                    // so firslty need to normalize the file path
                    var destpath = '',
                        templatespath = '';

                    srcpath = path.normalize(srcpath);
                    templatespath = srcpath.split(sep).slice(1).join(sep);

                    grunt.verbose.writeln('[precompile] ==== src template path: ', srcpath);

                    localesList.forEach(function(locale) {

                        destpath = getTemplateFilePath({
                                locale: locale,
                                filepath: srcpath,
                                task: itself
                        });

                        grunt.verbose.writeln('[precompile] ==== src template path in deployment folder: ', destpath);

                        templatesList.push(destpath);

                        grunt.file.copy(srcpath, destpath, {
                            noProcess: false
                        });

                    });

                });
            },
            /*
            ** Handle the {@i18n} tag in each dust template file in each locale, replace it with associated localized properties file
            ** Or show the missing key error message if the key is missing
            */
            generateLocalizedTemplates: function(options) {

                var _this = this,
                    keyPrefix = options.keyPrefix,
                    templatesList = this.getTemplatesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList();

                grunt.verbose.writeln(('[precompile] ==== templatesList is: ').bold, templatesList);
                templatesList.map(function(filepath) {
                    var dustFilePath = filepath,
                        dustFileContent = grunt.file.read(dustFilePath),
                        propsFilePath = dustFilePath.replace(dustRegExp, '.properties'),
                        isPropsExists = grunt.file.exists(propsFilePath),
                        templatesPropsJSON = isPropsExists ? parser.read(propsFilePath) : {};

                    // Validate whether the key in the dust templates properties file conform to the constraints
                    if (keyPrefix) {
                        _this.validatePropsKey(options, {
                            json: templatesPropsJSON,
                            file: propsFilePath
                        });
                    }

                    templatesPropsJSON = _this.convertJson(templatesPropsJSON);

                    return {
                        dustFilePath: dustFilePath,
                        dustFileContent: dustFileContent,
                        propsFilePath: propsFilePath,
                        templatesPropsJSON: templatesPropsJSON
                    };

                }).forEach(function(obj) {
                    var content = obj.dustFileContent,
                        dustFilePath = obj.dustFilePath,
                        templatesPropsJSON = obj.templatesPropsJSON,
                        isI18nExists = false,
                        localizedText = '',
                        locale = _this.getLocaleFromFilePath(dustFilePath),
                        commonPropsJson = {},
                        ret = '';

                    commonPropsJsonList.forEach(function(obj) {
                        if (obj[locale]) {
                          commonPropsJson = obj[locale];
                        }
                    });
                    /*
                    ** Though we can use the RegExp object's exec or String.prototype.match method,
                    ** however the String.prototype.replace method is much easier and flexible to generate the resouce bundle file
                    ** no matter this file format is a JAVA property or JSON file
                    */
                    ret = content.replace(i18nRegExp, function(match, key, value, offset, origStr) {

                        grunt.verbose.writeln('[precompile] ==== replace key with localed value: ', {match: match, key: key, value: value, offset: offset, origStr: origStr});

                        if (!isI18nExists) {
                            isI18nExists = true;
                        }

                        // Fetch the localized message associated with this key, firstly search in the associated dust template
                        // if not found, then search it in the common properties files, if still not found then abort the grunt task.
                        localizedText = templatesPropsJSON[key];

                        if (_this.isEmpty(localizedText)) {

                            localizedText = commonPropsJson[key];

                            if (_this.isEmpty(localizedText)) {
                                grunt.fail.fatal('[precompile] ==== [[ missing key: ' + (key).bold + ' ]] in file - ' + (dustFilePath).bold);
                            }
                            else {
                                grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                            }
                        }
                        else {
                            grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                        }

                        return localizedText;
                    });

                    if (isI18nExists) {
                        grunt.log.writeln('[precompile] ==== this file has i18n tag: ', dustFilePath);
                        grunt.file.write(dustFilePath, ret);
                    }
                });
            },

            validatePropsKey: function(options, settings) {
                var keyPrefix = options.keyPrefix,
                    json = settings.json,
                    propsFilePath = settings.file;

                if (!this.endsWith(keyPrefix, '.')) {
                    keyPrefix = keyPrefix + '.';
                }

                _.each(_.keys(json), function(key) {
                    if (key.indexOf(keyPrefix) !== 0) {
                        grunt.fail.fatal('[precompile] ==== [[ this key: ' + (key).bold + ' ]] in properties file - ' + (propsFilePath).bold + ' does not conform to the key constrains');
                    }
                });

            },

            checkRequiredConfig: function() {
                var requiredOptions = [
                    'localeFilesExpandPatterns',
                    'implementedLocalesList',
                    'getTemplateFilePath',
                    'getScriptsPropsFilePath',
                    'keyPrefix'
                ];

                itself.requiresConfig.apply(itself, _.map(requiredOptions, function(val) {
                    return [itself.name, itself.target, 'options', val].join('.');
                }));
            },

            copyLocalesPropsFiles: function(options) {
                var patterns = options.localeFilesExpandPatterns,
                    fileListMapping = grunt.file.expandMapping(patterns.src, patterns.dest, patterns);

                grunt.verbose.writeln('[precompile] ==== locale file list mapping: ', fileListMapping);
                _.each(fileListMapping, function(obj) {
                    var src = obj.src[0],
                        dest = obj.dest;

                    if (grunt.file.isDir(src)) {
                        grunt.file.mkdir(dest);
                    }
                    else {
                        grunt.file.copy(src, dest);
                    }
                });

                // Set locales root path in deployment folder
                this.setLocalesRootPath(patterns.dest);

                grunt.verbose.writeln(('[precompile] ==== localesRootPath is: ').bold.blue, this.getLocalesRootPath());
            },

            start: function(options) {
                this.generateScriptsProps(options);
                this.copyTemplateFiles(options);
                this.generateLocalizedTemplates(options);
            }

        };

        // Before running this task, firstly make sure all required config options has been specified.
        util.checkRequiredConfig();
        util.copyLocalesPropsFiles(options);

        // Initialize all of the variable values
        util.init(options);
        util.start(options);

    });

};
