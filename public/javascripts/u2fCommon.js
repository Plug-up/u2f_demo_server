var U2F = {
    /* Response codes */

    /* Request succeeded. */
    OK                    : 0,
    /* All plugged in devices are already enrolled. */
    ALREADY_ENROLLED      : 2,
    /* None of the plugged in devices are enrolled. */
    NONE_PLUGGED_ENROLLED : 3,
    /* One or more devices are waiting for touch. */
    WAIT_TOUCH            : 4,
    /* No device found. */
    NO_DEVICE             : 5,
    /* Unknown error during enrollment. */
    UNKNOWN_ERROR         : 7,
    /* Extension not found. */
    NO_EXTENSION          : 8,
    /* No devices enrolled for this user. */
    NO_DEVICES_ENROLLED   : 9,
    /* errors due to chrome issues */
    BROWSER_ERROR         : 10,
    /* extension taking too long */
    LONG_WAIT             : 11,
    /* Bad request. */
    BAD_REQUEST           : 12,
    /* All devices are too busy to handle your request. */
    BUSY                  : 13,
    /* There is a bad app_id in the request. */
    BAD_APP_ID            : 14
}