import json

import geopandas as gpd
import pyarrow as pa
import pyarrow.parquet as pq
import pygeos
from geopandas.io.arrow import _create_metadata

gdf = gpd.read_file(gpd.datasets.get_path("naturalearth_cities"))

gdf.to_parquet("naturalearth_cities_wkb.parquet", index=None)


def construct_geoarrow_table(gdf: gpd.GeoDataFrame) -> pa.Table:
    # Note in this quick example we omit metadata on the table header
    non_geo_cols = [col for col in gdf.columns if col != gdf.geometry.name]
    table = pa.Table.from_pandas(gdf[non_geo_cols])
    pygeos_array = pygeos.from_shapely(gdf.geometry.values)
    coords = pygeos.get_coordinates(pygeos_array)
    parr = pa.FixedSizeListArray.from_arrays(coords.flat, 2)
    geo_metadata = _create_metadata(gdf)
    geo_metadata["columns"][gdf._geometry_column_name]["encoding"] = "geoarrow"
    table_with_geom = table.append_column("geometry", parr)
    metadata = table_with_geom.schema.metadata
    metadata.update({b"geo": json.dumps(geo_metadata).encode()})
    return table_with_geom.replace_schema_metadata(metadata)


gdf_arrow_encoding = construct_geoarrow_table(gdf)
pq.write_table(
    gdf_arrow_encoding, "naturalearth_cities_geoarrow.parquet", compression="snappy"
)
