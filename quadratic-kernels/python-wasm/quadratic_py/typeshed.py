#!/usr/bin/env python3

import os
import json
import sys


def create_typeshed_json(source_path):
    results = dict(files={})
    output_path = f"../dist/typeshed.json"
    
    print(f"{source_path} -> {output_path}")

    for (source_dir, prefix) in ((source_path, "/typeshed/"), ("config", "/src/")):
        strip_parts = len(source_dir.split(os.path.sep))
       
        for (dirpath, dirnames, filenames) in os.walk(source_dir):
            for f in sorted(filenames):
                if os.path.splitext(f)[1] != ".pyi":
                    continue

                source_path = os.path.join(dirpath, f)
                destination = os.path.join(
                    prefix,
                    os.path.join(*source_path.split(os.path.sep)[strip_parts:]),
                )
       
                print(f"  {source_path} -> {destination}")
       
                text = open(source_path, "r", encoding="utf-8").read()
                results["files"][destination] = text

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(results, indent=2))

if __name__ == "__main__":
    print ('argument list', sys.argv)
    create_typeshed_json("typeshed")
    # for lang in os.listdir("lang"):
    #     source_path = os.path.join("lang", lang, "typeshed")
    #     create_typeshed_json(source_path, lang)