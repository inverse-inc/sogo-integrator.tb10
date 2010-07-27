/* -*- Mode: java; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

var iCc = Components.classes;
var iCi = Components.interfaces;
var shouldRestart = false;
var errorsHappened = false;

function inverseUpdateListener() {
}

inverseUpdateListener.prototype = {
 QueryInterface: function (aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports)
            && !aIID.equals(Components.interfaces.nsIAddonUpdateCheckListener)
            && !aIID.equals(Components.interfaces.nsIAddonUpdateListener)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },
 onAddonUpdateEnded: function(addon, status) {
        dump("addon: " + addon.id + "; status: " + status + "\n");
    },
 onAddonUpdateStarted: function(addon) {
        dump("addonupdatestarted\n");
    },
 onUpdateEnded: function() {
        dump("updateended\n");
    },
 onUpdateStarted: function() {
        dump("updatestarted\n");
    },
 onStateChange: function(addon, state, value) {
        dump("onstatechange: " + state + "\n");
    },
 onProgress: function (addon, value, maxValue) {
        dump("onprogress: " + value + "\n");
    }
};

function configureCurrentExtensions(cfExtensions) {
    if (cfExtensions.length > 0) {
        for (var i = 0; i < cfExtensions.length; i++)
            dump("configuring extension (fake): " + cfExtensions[i] + "\n");
    }
    this.configurationDone = true;
    this.restartIfPossible();
}

function uninstallCurrentExtensions(cfExtensions) {
    var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"]
                            .getService().QueryInterface(iCi.nsIExtensionManager);
	
    dump("About to remove " + cfExtensions.length + " extensions\n");
    if (cfExtensions.length > 0) {
        for (var i = 0; i < cfExtensions.length; i++) {
            dump("Removing existing extension: " + cfExtensions[i] + "\n");
            gExtensionManager.uninstallItem(cfExtensions[i]);
        }
    }
    this.uninstallDone = true;
    shouldRestart = true;
    this.restartIfPossible();
}

function downloadMissingExtensions(dlExtensions) {
    if (dlExtensions.length > 0) {
        //var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"].getService().QueryInterface(iCi.nsIExtensionManager);
        //     var dlDlg
        //       = window.openDialog("chrome://mozapps/content/downloads/downloads.xul",
        // 			  "ext", "chrome,dialog,centerscreen,resizable");
        window.extensionDownloads = [];
        //     window.downloadDialog = dlDlg;
        for (var i = 0; i < dlExtensions.length; i++) {
            dump("downloading " + dlExtensions[i].name + "\n");
            window.extensionDownloads.push(this.downloadExtension(dlExtensions[i]));
        }
        dump("starting loop\n");
        window.downloadInterval = window.setInterval(window.checkDownloadInterval, 500);
    }
    else {
        this.downloadsDone = true;
        dump("no extension missing\n");
    }
}

function downloadExtension(dlExtension) {
    dump("download of extension: " + dlExtension.url + "\n");
    var destURL = this.extensionDestURL(dlExtension.url);

    var downloadMgr = iCc['@mozilla.org/download-manager;1']
                      .getService(iCi.nsIDownloadManager);
    downloadMgr.cleanUp();
    var ioService = iCc["@mozilla.org/network/io-service;1"]
                    .getService(iCi.nsIIOService);
    var extensionURI = ioService.newURI(dlExtension.url, null, null);
    var destURI = ioService.newURI(destURL, null, null);

    var persist = iCc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
        .createInstance(iCi.nsIWebBrowserPersist);
    persist.persistFlags
        = (iCi.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION
           | iCi.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES
           | iCi.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE);

    var ret = downloadMgr.addDownload(-1, extensionURI, destURI, dlExtension.name,
                                      "chrome://mozapps/skin/xpinstall/xpinstallItemGeneric.png",
                                      null, -1, null, persist);
    persist.progressListener = ret;
    persist.saveURI(extensionURI, null, null, null, null, destURI);

    return ret.targetFile;
}

function extensionDestURL(extensionURL) {
    var parts = extensionURL.split("/");

    var fileLocator = iCc["@mozilla.org/file/directory_service;1"]
                      .getService(iCi.nsIProperties);
    var destURL = ("file://" + fileLocator.get("TmpD", iCi.nsIFile).path
                   + "/" + parts[parts.length - 1]);

    return destURL;
}

function checkDownloadInterval() {
    // dump("check\n");

    var downloadMgr = iCc['@mozilla.org/download-manager;1']
                      .getService(iCi.nsIDownloadManager);
    if (!downloadMgr.activeDownloadCount) {
        clearInterval(window.downloadInterval);
        downloadMgr.cleanUp();
        //     if (window.downloadDialog)
        //       window.downloadDialog.close();

        this.installDownloadedExtensions();
        dump("loop ended\n");
    }

    return true;
}

function installDownloadedExtensions() {
    var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"]
                            .getService(iCi.nsIExtensionManager);

    gExtensionManager.addUpdateListener(new inverseUpdateListener());
    dump("downloads:  " + window.extensionDownloads.length + "\n");
    if (window.extensionDownloads.length) {
        for (var i = 0; i < window.extensionDownloads.length; i++) {
            dump("installing: " + window.extensionDownloads[i].leafName + "\n");
            try {
                gExtensionManager.installItemFromFile(window.extensionDownloads[i],
                                                      "app-profile");
            }
            catch(e) {
                errorsHappened = true;
                dump("installation failure\n");
            }
        }
        shouldRestart = true;
    }

    this.downloadsDone = true;
    this.restartIfPossible();
}

function restartIfPossible() {
    if (this.downloadsDone && this.configurationDone && this.uninstallDone) {
        if (errorsHappened) {
            if (window.opener)
                window.opener.deferredCheckFolders();
            window.close();
        }
        else {
            if (shouldRestart) {
                var dialog = document.getElementById("inverseMessengerUpdateDlg");
                var button = dialog.getButton("accept");
                button.disabled = false;
                var image = document.getElementById("spinner");
                image.collapsed = true;
                var restartMessage = document.getElementById("restartMessage");
                var message = document.getElementById("message");
                var maxChild = message.childNodes.length;
                for (var i = maxChild - 1; i > -1; i--)
                    message.removeChild(message.childNodes[i]);
                message.appendChild(document.createTextNode(restartMessage.value));
                window.setTimeout(updateDialogOnReload, 3000);
            }
        }
    }
}

function onAcceptClick() {
    var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
                     .getService(iCi.nsIAppStartup);
    appStartup.quit(iCi.nsIAppStartup.eRestart
                    | iCi.nsIAppStartup.eAttemptQuit);

    return false;
}

function onCancelClick() {
    return false;
}

function updateDialogOnReload() {
    dump("Restarting...\n");
    var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
                     .getService(iCi.nsIAppStartup);
    appStartup.quit(iCi.nsIAppStartup.eRestart
                    | iCi.nsIAppStartup.eForceQuit);
}

function updateDialogOnLoad () {
    // 	dump("onRealLoad...\n");
    var dialog = document.getElementById("inverseMessengerUpdateDlg");
    var button = dialog.getButton("accept");
    button.disabled = true;
    shouldRestart = false;

    try {
        this.configurationDone = false;
        this.downloadsDone = false;
        this.uninstallDone = false;
        var results = window.arguments[0];
        this.downloadMissingExtensions(results["urls"]);
        this.configureCurrentExtensions(results["configuration"]);
        this.uninstallCurrentExtensions(results["uninstall"]);
    }
    catch(e) {
        dump("updateDialogOnLoad: " + e + "\n");
        if (window.opener)
            window.opener.deferredCheckFolders();
        window.close();
    }
}

// dump("we will load..\n");
window.addEventListener("load", updateDialogOnLoad, false);
