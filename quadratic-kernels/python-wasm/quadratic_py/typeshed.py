#!/usr/bin/env python3

import os
import json

def generate_json() -> str:
    results = dict(files={})
    output_path = f"dist/pyright-initialization.json"
    base_path = "quadratic_py/quadratic_api/pyright_initialization"
    third_party_stubs = ("dist/typings/typeshed/", "/")
    config_path = (f"{base_path}/config/", "/")
    builtins_path = (f"{base_path}/builtins/", "/")
    allowed_extensions = (".pyi", ".json")

    for (directory, prefix) in (third_party_stubs, config_path, builtins_path):
        print(f"Processing {os.path.realpath(directory)} to {prefix}")

        strip_parts = len(directory.split(os.path.sep)) - 1
       
        for (dirpath, _, filenames) in os.walk(directory):
            for filename in sorted(filenames):
                # print(f"Processing {filename}")
                if os.path.splitext(filename)[1] not in allowed_extensions:
                    continue

                path = os.path.join(dirpath, filename)
                # print(f"path", strip_parts, os.path.sep, *path.split(os.path.sep)[4])
                destination = os.path.join(
                    prefix,
                    os.path.join(*path.split(os.path.sep)[strip_parts:]),
                )
                # print(f"destination {destination}")
       
                text = open(path, "r", encoding="utf-8").read()
                results["files"][destination] = text

    with open(output_path, "w", encoding="utf-8") as file:
        file.write(json.dumps(results, indent=2))
    
    return os.path.realpath(output_path)

if __name__ == "__main__":
    output_path = generate_json()
    print(f"Generated typeshed at {output_path}")