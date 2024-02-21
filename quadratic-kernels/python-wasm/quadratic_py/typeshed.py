#!/usr/bin/env python3

import os
import json

def generate_json(path):
    results = dict(files={})
    output_path = f"../dist/typeshed.json"

    for (directory, prefix) in ((path, "/typeshed/"), ("config", "/src/")):
        strip_parts = len(directory.split(os.path.sep))
       
        for (dirpath, _, filenames) in os.walk(directory):
            for filename in sorted(filenames):
                if os.path.splitext(filename)[1] != ".pyi":
                    continue

                path = os.path.join(dirpath, filename)
                destination = os.path.join(
                    prefix,
                    os.path.join(*path.split(os.path.sep)[strip_parts:]),
                )
       
                text = open(path, "r", encoding="utf-8").read()
                results["files"][destination] = text

    with open(output_path, "w", encoding="utf-8") as file:
        file.write(json.dumps(results, indent=2))
    
    return os.path.realpath(output_path)

if __name__ == "__main__":
    output_path = generate_json("typeshed")
    print(f"Generated typeshed at {output_path}")