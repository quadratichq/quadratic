#!/bin/bash

pushd-quiet () {
    command pushd "$@" > /dev/null || exit
}

popd-quiet () {
    command popd "$@" > /dev/null || exit
}