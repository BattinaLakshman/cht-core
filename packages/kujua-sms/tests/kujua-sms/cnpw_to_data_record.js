var updates = require('kujua-sms/updates'),
    lists = require('kujua-sms/lists'),
    logger = require('kujua-utils').logger,
    baseURL = require('duality/core').getBaseURL(),
    appdb = require('duality/core').getDBURL(),
    querystring = require('querystring'),
    jsDump = require('jsDump'),
    fakerequest = require('couch-fakerequest'),
    helpers = require('../../test-helpers/helpers');


var example = {
    sms_message: {
       from: "+13125551212",
       message: 'SUR WKN2# WKS 3# AFP 99# NNT 0# MSL 5# AES01',
       sent_timestamp: '01-19-12 18:45',
       sent_to: "+15551212",
       type: "sms_message",
       locale: "en",
       form: "CNPW"
    },
    clinic: {
        "_id": "4a6399c98ff78ac7da33b639ed60f458",
        "_rev": "1-0b8990a46b81aa4c5d08c4518add3786",
        "type": "clinic",
        "name": "Example clinic 1",
        "contact": {
            "name": "Sam Jones",
            "phone": "+13125551212"
        },
        "parent": {
            "type": "health_center",
            "contact": {
                "name": "Neal Young",
                "phone": "+17085551212"
            },
            "parent": {
                "type": "district_hospital",
                "contact": {
                    "name": "Bernie Mac",
                    "phone": "+14155551212"
                }
            }
        }
    }
};

var expected_callback = {
    data: {
        type: "data_record_cdc_nepal",
        form: "CNPW",
        related_entities: {
            clinic: null
        },
        sms_message: example.sms_message,
        from: "+13125551212",
        errors: [],
        tasks: [],
        wkn: 2,
        wks: 3,
        afp: 99,
        nnt: 0,
        msl: 5,
        aes: 1
    }
};


/*
 * STEP 1:
 *
 * Run add_sms and expect a callback to add a clinic to a data record which
 * contains all the information from the SMS.
 *
 */
exports.cnpw_to_record = function (test) {

    test.expect(28);

    // Data parsed from a gateway POST
    var data = {
        from: '+13125551212',
        message: 'SUR WKN2# WKS 3# AFP 99# NNT 0# MSL 5# AES01',
        sent_timestamp: '01-19-12 18:45',
        sent_to: '+15551212'
    };

    // request object generated by duality includes uuid and query.form from
    // rewriter.
    var req = {
        uuid: '14dc3a5aa6',
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);

    var resp_body = JSON.parse(resp[1].body);

    // assert that we are parsing sent_timestamp
    test.same(
        'Thu Jan 19 2012',
        new Date(resp_body.callback.data.reported_date).toDateString()
    );

    test.equal(
        "18:45",
        new Date(resp_body.callback.data.reported_date)
            .toTimeString().match(/^18:45/)[0]
    );

    delete resp_body.callback.data.reported_date;

    test.same(
        resp_body.callback.options.path,
        baseURL + "/CNPW/data_record/add/clinic/%2B13125551212");

    test.same(
        resp_body.callback.data,
        expected_callback.data);

    step2(test, helpers.nextRequest(resp_body, 'CNPW'));

};


/*
 * STEP 2:
 *
 * Run data_record/add/clinic and expect a callback to
 * check if the same data record already exists.
 *
 */
var step2 = function(test, req) {

    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(
        resp_body.callback.options.path,
        baseURL + '/CNPW/data_record/merge/cnpw/%2B13125551212/2');

    test.same(
        resp_body.callback.data.related_entities,
        {clinic: clinic});

    test.same(resp_body.callback.data.errors, []);

    step3(test, helpers.nextRequest(resp_body, 'CNPW'));

};


/*
 * STEP 3:
 *
 * A data record does not exist.
 *
 * Run data_record/merge/cnpw/phone/wkn and expect a callback to create a
 * new data record.
 *
 */
var step3 = function(test, req) {
    var viewdata = {rows: []};

    var resp = fakerequest.list(lists.data_record_merge, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(resp_body.callback.options.method, "POST");
    test.same(resp_body.callback.options.path, appdb);

    test.same(resp_body.callback.data.errors, []);
    test.same(
        resp_body.callback.data.sms_message,
        example.sms_message);    
    
    step1_with_errors(test);

};


/*
 * STEP 1 WITH ERRORS:
 *
 * Run add_sms and expect errors to appear on the 
 * callback object.
 *
 */
var step1_with_errors = function(test) {
    var data = {
        from: '+13125551212',
        message: 'SUR WKN2# WKS 3# AFP 99# NNT 0## AES01',
        sent_timestamp: '01-19-12 18:45',
        sent_to: '+15551212'
    };

    var req = {
        uuid: '14dc3a5aa6',
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);

    var resp_body = JSON.parse(resp[1].body);

    test.same(resp_body.payload.success, false);
    test.same(resp_body.payload.messages[0].message,
        "Missing field: Measles");
    
    test.same(resp_body.callback.data.errors[0],
        "Missing field: Measles");
    
    test.same(
        resp_body.callback.options.path,
        baseURL + "/CNPW/data_record/add/clinic/%2B13125551212");
    
    step2_with_errors(test, helpers.nextRequest(resp_body, 'CNPW'));
    
};


/*
 * STEP 2 WITH ERRORS:
 *
 * Run data_record/add/clinic and expect a callback to
 * check if the same data record already exists when
 * there were errors in the add_sms function.
 *
 */
var step2_with_errors = function(test, req) {
    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(
        resp_body.callback.options.path,
        baseURL + '/CNPW/data_record/merge/cnpw/%2B13125551212/2');

    test.same(
        resp_body.callback.data.related_entities,
        {clinic: clinic});

    test.same(resp_body.callback.data.errors[0],
        "Missing field: Measles");
    
    step3_with_errors(test, helpers.nextRequest(resp_body, 'CNPW'));
    
};


/*
 * STEP 3 WITH ERRORS:
 *
 * Check that when posting again with the same 
 * phone and wkn the data is overwritten on
 * the original record.
 *
 */
var step3_with_errors = function(test, req) {
    var viewdata = {rows: [
        {
            key: ["%2B13125551212", "2", "777399c98ff78ac7da33b639ed60f422"],
            value: {
                _id: "777399c98ff78ac7da33b639ed60f422",
                _rev: "484399c98ff78ac7da33b639ed60f923",
                wkn: 2,
                wks: 3,
                afp: 80,
                nnt: 70,
                msl: 60,
                aes: 50
            }
        }
    ]};

    var resp = fakerequest.list(lists.data_record_merge, viewdata, req);
    var resp_body = JSON.parse(resp.body);

    test.same(
        resp_body.callback.data._rev,
        "484399c98ff78ac7da33b639ed60f923");

    test.same(
        resp_body.callback.options.path,
        appdb + "/777399c98ff78ac7da33b639ed60f422");

    test.same(
        resp_body.callback.options.method,
        "PUT");

    test.same(resp_body.callback.data.tasks, []);
    
    test.same(resp_body.callback.data.errors[0],
        "Missing field: Measles");

    test.same(resp_body.callback.data.afp, 99);
    test.same(resp_body.callback.data.nnt, 0);
    test.same(resp_body.callback.data.aes, 1);
    
    
    
    var body = JSON.parse(req.body);
    body.errors = [];
    body.msl = 5;
    req.body = JSON.stringify(body);
    
    var viewdata = {rows: [
        {
            key: ["%2B13125551212", "2", "777399c98ff78ac7da33b639ed60f422"],
            value: {
                _id: "777399c98ff78ac7da33b639ed60f422",
                _rev: "484399c98ff78ac7da33b639ed60f923",
                wkn: 2,
                wks: 3,
                afp: 80,
                nnt: 70,
                aes: 50,
                errors: ["Missing field: Measles"]
            }
        }
    ]};

    var resp = fakerequest.list(lists.data_record_merge, viewdata, req);
    var resp_body = JSON.parse(resp.body);

    test.same(resp_body.callback.data.errors, []);
    test.same(resp_body.callback.data.msl, 5);
    
    test.done();    
};