function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("folder-handler.js: failed to include '" + files[i] + "'\n" + e +
                 "\nFile: " + e.fileName +
                 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/vcards.utils.js",
           "chrome://sogo-connector/content/common/common-dav.js"]);

function AddressbookHandler() {
    this.doubles = {};
}

AddressbookHandler.prototype = {
    doubles: null,
    getExistingDirectories: function() {
        // dump("getExistingDirectories\n");
        let existing = {};

        let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                  .getService(Components.interfaces.nsIAbManager);
        let children = abManager.directories;
        while (children.hasMoreElements()) {
            let ab = children.getNext().QueryInterface(Components.interfaces.nsIAbDirectory);
            let rdfAB = ab.QueryInterface(Components.interfaces.nsIRDFResource);
            let rdfValue = rdfAB.Value;
            let abURL = null;
            // dump("  rdfAB.Value: " + rdfValue + "\n");
            // dump("  ab.URI: " + ab.URI + "\n");
            if (isGroupdavDirectory(rdfValue)) {
                let service = new GroupdavPreferenceService(ab.dirPrefId);
                abURL = service.getURL();
                // dump("  GroupDAV existing: " + ab.dirPrefId + " - " + abURL + "\n");
            }
            else if (isCardDavDirectory(rdfValue)) {
                let carddavPrefix = "carddav://";
                abURL = ab.URI.substr(carddavPrefix.length);
                // dump("  CardDAV existing: " + ab.dirPrefId + " - " + abURL + "\n");
            }
            if (abURL) {
                if (existing[abURL])
                    this.doubles[rdfValue] = ab;
                else
                    existing[abURL] = ab;
            }
        }
        dump("   end getExistingDirectories\n");

        return existing;
    },
    removeDoubles: function() {
        let newDoubles = [];
        /* we need to use as hash here to ensure each abDirectory is only present
         once. */
        for (let rdfValue in this.doubles) {
            dump("   double rdfValue: "  + rdfValue + "\n");
            newDoubles.push(this.doubles[rdfValue]);
        }

        dump("doubles:  " + newDoubles.length + "\n");

        SCDeleteDirectories(newDoubles);
    },
    addDirectories: function(newDirs) {
        for (let i = 0; i < newDirs.length; i++) {
            let description = "" + newDirs[i]['displayName'];
            let url = newDirs[i]['url'];
            let readOnly = (newDirs[i]['owner'] == "nobody");
            if (readOnly)
                SCCreateCardDAVDirectory(description, url);
            else {
                let directory = SCCreateGroupDAVDirectory(description, url);
                let URI = directory.URI;
                let synchronizer = new GroupDavSynchronizer(URI);
                synchronizer.start();
            }
        }
    },
    renameDirectories: function(dirs) {
        for (let i = 0; i < dirs.length; i++) {
            let ab = dirs[i]['folder'];
            let oldName = ab.description;
            let displayName = dirs[i]['displayName'];
            if (oldName != displayName) {
                ab.description = displayName;
            }
        }
    },
    removeDirectories: function(oldDirs) {
        dump("removeDirectories: backtrace: " +  backtrace() + "\n\n\n");
        for (let i = 0; i < oldDirs.length; i++) {
            let rdfValue = oldDirs[i].QueryInterface(Components.interfaces.nsIRDFResource).Value;
            SCDeleteDAVDirectory(rdfValue);
        }
    },
    urlForParentDirectory: function() {
        return sogoBaseURL() + "Contacts";
    },
    ensurePersonalIsRemote: function() {
        this._ensureFolderIsRemote("abook.mab");
        let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch));
        if (this._autoCollectIsHistory(prefService))
            this._ensureHistoryIsPersonal(prefService);
        this._ensureFolderIsRemote("history.mab");
    },
    _ensureFolderIsRemote: function(filename) {
        let localURI = "moz-abmdbdirectory://" + filename;
        let localAB = SCGetDirectoryFromURI(localURI);
        if (localAB) {
            let personalURL = sogoBaseURL() + "Contacts/personal/";

            // 		dump("personalURL: " + personalURL + "\n");
            let existing = this.getExistingDirectories();
            let personalAB = existing[personalURL];

            if (!personalAB)
                personalAB = existing[personalURL.substr(0, personalURL.length - 1)];
            if (!personalAB) {
                let newDir = {url: personalURL,
                              displayName: "personal",
                              owner: sogoUserName()};
                this.addDirectories([newDir]);
                existing = this.getExistingDirectories();
                personalAB = existing[personalURL];
            }
            if (personalAB) {
                /* ugly hack, we empty the addressbook after its cards were
                 transfered, so that we can be sure the ab no longer "exists" */
                SCCopyAddressBook(localAB, personalAB);
                // let cardsArray = Components.classes["@mozilla.org/array;1"]
                // 												   .createInstance(Components.interfaces.nsIArray);
                // let cards = localAB.childCards;
                // while (cards.hasMoreElements) {
                // 	for (let i = 0; i < cards.length; i++)
                // 		cardsArray.appendElement(cards[i], false);
                // }
                // localAB.deleteCards(cardsArray);
                SCDeleteDirectory(localAB);
            }
            else
                throw "Personal Addressbook cannot be replaced!";
        }
    },
    _autoCollectIsHistory: function(prefService) {
        let isHistory = false;
        try {
            let abURI = prefService.getCharPref("mail.collect_addressbook");
            isHistory = (abURI == "moz-abmdbdirectory://history.mab"
                         || abURI == "moz-abmdbdirectory://abook.mab");
        }
        catch(e) {
        }

        return isHistory;
    },
    _ensureHistoryIsPersonal: function(prefService) {
        let personalURL = sogoBaseURL() + "Contacts/personal/"
        let existing = this.getExistingDirectories();
        let personalAB = existing[personalURL];
        prefService.setCharPref("mail.collect_addressbook", personalAB.URI);
    },
    ensureAutoComplete: function() {
        let prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch));
        let prefACURL;
        try {
            let prefACURLID = prefService.getCharPref("sogo-integrator.autocomplete.server.urlid");
            prefACURL = sogoBaseURL() + "Contacts/" + prefACURLID + "/";
        }
        catch(e) {
            prefACURL = null;
        }
        if (prefACURL) {
            let existing = this.getExistingDirectories();
            let acAB = existing[prefACURL];
            if (!acAB) {
                let newDir = {url: prefACURL,
                              displayName: "public",
                              owner: "nobody"};
                this.addDirectories([newDir]);
                existing = this.getExistingDirectories();
                acAB = existing[prefACURL];
            }
            if (acAB) {
                let abPrefID = acAB.dirPrefId;
                prefService.setCharPref("ldap_2.autoComplete.directoryServer", abPrefID);
            }
            else
                dump("Could not set public directory as preferred autocomplete server\n");
        }
    }
};
