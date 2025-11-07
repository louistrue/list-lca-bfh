#!/usr/bin/env python3
"""
IFC to LCA CSV Export Script
Extracts elements, materials, building storeys, volumes, and classifications from IFC files.
"""

import ifcopenshell
import ifcopenshell.util.element as uel
import pandas as pd
from typing import Optional, Tuple


def get_element_name(element) -> str:
    """Get element name - prefer Name, fallback to GlobalId"""
    if hasattr(element, 'Name') and element.Name:
        return element.Name
    elif hasattr(element, 'GlobalId') and element.GlobalId:
        return element.GlobalId
    return element.is_a().replace('Ifc', '')


def get_element_guid(element) -> str:
    """Get element GUID (GlobalId)"""
    if hasattr(element, 'GlobalId') and element.GlobalId:
        return element.GlobalId
    return ''


def get_ifc_class(element) -> str:
    """Get proper IFC class name (IfcWall, IfcSlab, etc.)"""
    return element.is_a()


def get_material_name(element) -> str:
    """Extract material name from element"""
    try:
        # Try from PropertySets
        psets = uel.get_psets(element)
        material_psets = ['Material', 'Pset_MaterialCommon', 'MaterialProperties']
        for pset_name in material_psets:
            if pset_name in psets:
                props = psets[pset_name]
                if isinstance(props, dict):
                    for key in ['Name', 'Material', 'MaterialName']:
                        if key in props and props[key]:
                            return str(props[key])
        
        # Try from IFC materials
        materials = uel.get_materials(element)
        if materials:
            material = materials[0]
            if hasattr(material, 'Name') and material.Name:
                return material.Name
            elif hasattr(material, 'Category') and material.Category:
                return material.Category
    except:
        pass
    
    return element.is_a().replace('Ifc', '')


def get_type_name(element, material_name: str) -> str:
    """Extract type name from IfcRelDefinesByType relationship"""
    type_name = None
    
    try:
        # Get type from IfcRelDefinesByType relationship
        if hasattr(element, 'IsTypedBy') and element.IsTypedBy:
            for rel in element.IsTypedBy:
                if rel.is_a('IfcRelDefinesByType') and rel.RelatingType:
                    type_obj = rel.RelatingType
                    
                    # Get type name
                    if hasattr(type_obj, 'Name') and type_obj.Name:
                        type_name = str(type_obj.Name)
                    elif hasattr(type_obj, 'Tag') and type_obj.Tag:
                        type_name = str(type_obj.Tag)
                    
                    break
        
        # Return type name if found, otherwise return material name
        return type_name if type_name else material_name
    except Exception:
        # Fallback to material name if anything fails
        return material_name


def get_building_storey(element) -> str:
    """Extract building storey - handles elements directly in storeys or in spaces that are in storeys"""
    try:
        if hasattr(element, 'ContainedInStructure'):
            for rel in element.ContainedInStructure:
                if rel.RelatingStructure:
                    structure = rel.RelatingStructure
                    
                    # Direct building storey relationship
                    if structure.is_a('IfcBuildingStorey'):
                        if hasattr(structure, 'Name') and structure.Name:
                            return structure.Name
                        elif hasattr(structure, 'LongName') and structure.LongName:
                            return structure.LongName
                        elif hasattr(structure, 'Elevation'):
                            return f"Storey_{structure.Elevation}"
                    
                    # Element is in a space - check if space is in a storey
                    elif structure.is_a('IfcSpace'):
                        if hasattr(structure, 'ContainedInStructure'):
                            for space_rel in structure.ContainedInStructure:
                                if space_rel.RelatingStructure:
                                    storey = space_rel.RelatingStructure
                                    if storey.is_a('IfcBuildingStorey'):
                                        if hasattr(storey, 'Name') and storey.Name:
                                            return storey.Name
                                        elif hasattr(storey, 'LongName') and storey.LongName:
                                            return storey.LongName
                                        elif hasattr(storey, 'Elevation'):
                                            return f"Storey_{storey.Elevation}"
    except:
        pass
    
    return 'Unknown'


def get_classification(element, model) -> Tuple[str, str]:
    """Extract eBKP classification code and name"""
    code = ''
    name = ''
    
    try:
        # Check PropertySets for eBKP classification
        psets = uel.get_psets(element)
        
        # Check eBKP-H first (highest priority)
        if 'eBKP-H' in psets:
            props = psets['eBKP-H']
            if isinstance(props, dict):
                # Look for code and name in various formats
                for key in ['Code', 'ClassificationCode', 'ItemReference', 'Identification']:
                    if key in props and props[key]:
                        code = str(props[key])
                        break
                
                for key in ['Name', 'ClassificationName', 'Description']:
                    if key in props and props[key]:
                        name = str(props[key])
                        break
                
                # Sometimes eBKP-H is stored as a single property value like "C03.01, Structural columns exterior"
                if not code and not name:
                    for key, value in props.items():
                        if value and isinstance(value, str):
                            # Check if it looks like "CODE, Name" format
                            if ',' in value:
                                parts = value.split(',', 1)
                                if not code:
                                    code = parts[0].strip()
                                if not name:
                                    name = parts[1].strip() if len(parts) > 1 else ''
                            elif not code:
                                code = str(value)
        
        # Check other eBKP PropertySets if eBKP-H didn't provide a result
        if not code and not name:
            classification_psets = ['eBKP', 'Classification', 'Pset_Classification']
            for pset_name in classification_psets:
                if pset_name in psets:
                    props = psets[pset_name]
                    if isinstance(props, dict):
                        # Look for code and name in various formats
                        for key in ['Code', 'ClassificationCode', 'ItemReference', 'Identification']:
                            if key in props and props[key]:
                                code = str(props[key])
                                break
                        
                        for key in ['Name', 'ClassificationName', 'Description']:
                            if key in props and props[key]:
                                name = str(props[key])
                                break
                        
                        # Sometimes classification is stored as a single property value
                        if not code and not name:
                            for key, value in props.items():
                                if value and isinstance(value, str):
                                    # Check if it looks like "CODE, Name" format
                                    if ',' in value:
                                        parts = value.split(',', 1)
                                        if not code:
                                            code = parts[0].strip()
                                        if not name:
                                            name = parts[1].strip() if len(parts) > 1 else ''
                                    elif not code:
                                        code = str(value)
        
        # Check eBKP classification relationships
        ebkp_rel = None
        
        # Collect eBKP classification relationships
        if hasattr(element, 'HasAssignments'):
            for assignment in element.HasAssignments:
                if assignment.is_a('IfcRelAssociatesClassification'):
                    rel_name = assignment.Name if hasattr(assignment, 'Name') and assignment.Name else ''
                    if 'eBKP-H' in rel_name or 'eBKP' in rel_name:
                        ebkp_rel = assignment
                        break
        
        # Also check reverse relationships
        if not ebkp_rel:
            for rel in model.by_type('IfcRelAssociatesClassification'):
                if hasattr(rel, 'RelatedObjects') and element in rel.RelatedObjects:
                    rel_name = rel.Name if hasattr(rel, 'Name') and rel.Name else ''
                    if 'eBKP-H' in rel_name or 'eBKP' in rel_name:
                        ebkp_rel = rel
                        break
        
        # Process eBKP relationship if found
        if ebkp_rel and not code and not name:
            classification_ref = ebkp_rel.RelatingClassification
            
            if classification_ref.is_a('IfcClassificationReference'):
                if hasattr(classification_ref, 'ItemReference') and classification_ref.ItemReference:
                    code = str(classification_ref.ItemReference)
                elif hasattr(classification_ref, 'Identification') and classification_ref.Identification:
                    code = str(classification_ref.Identification)
                
                if hasattr(classification_ref, 'Name') and classification_ref.Name:
                    name = str(classification_ref.Name)
    except:
        pass
    
    return code, name


def get_quantities(element) -> dict:
    """Extract all quantities from BaseQuantities or other quantity sets"""
    quantities = {
        'GrossVolume': None,
        'NetVolume': None,
        'Length': None,
        'GrossArea': None,
        'NetArea': None,
        'GrossFootprintArea': None,
        'NetFootprintArea': None,
        'GrossSideArea': None,
        'NetSideArea': None,
        'GrossSurfaceArea': None,
        'NetSurfaceArea': None,
    }
    
    try:
        # Try PropertySets first
        psets = uel.get_psets(element)
        
        # Check BaseQuantities
        if 'BaseQuantities' in psets:
            base_quantities = psets['BaseQuantities']
            if isinstance(base_quantities, dict):
                # Volume
                if 'GrossVolume' in base_quantities:
                    try:
                        quantities['GrossVolume'] = float(base_quantities['GrossVolume'])
                    except (ValueError, TypeError):
                        pass
                if 'NetVolume' in base_quantities:
                    try:
                        quantities['NetVolume'] = float(base_quantities['NetVolume'])
                    except (ValueError, TypeError):
                        pass
                if 'Volume' in base_quantities and quantities['GrossVolume'] is None:
                    try:
                        quantities['GrossVolume'] = float(base_quantities['Volume'])
                    except (ValueError, TypeError):
                        pass
                
                # Length
                if 'Length' in base_quantities:
                    try:
                        quantities['Length'] = float(base_quantities['Length'])
                    except (ValueError, TypeError):
                        pass
                
                # Areas
                area_keys = [
                    ('GrossArea', 'GrossArea'),
                    ('NetArea', 'NetArea'),
                    ('GrossFootprintArea', 'GrossFootprintArea'),
                    ('NetFootprintArea', 'NetFootprintArea'),
                    ('GrossSideArea', 'GrossSideArea'),
                    ('NetSideArea', 'NetSideArea'),
                    ('GrossSurfaceArea', 'GrossSurfaceArea'),
                    ('NetSurfaceArea', 'NetSurfaceArea'),
                ]
                
                for key, quantity_key in area_keys:
                    if key in base_quantities:
                        try:
                            quantities[quantity_key] = float(base_quantities[key])
                        except (ValueError, TypeError):
                            pass
        
        # Check all PropertySets for quantity keys
        for pset_name, props in psets.items():
            if isinstance(props, dict):
                # Volume
                if 'GrossVolume' in props and quantities['GrossVolume'] is None:
                    try:
                        quantities['GrossVolume'] = float(props['GrossVolume'])
                    except (ValueError, TypeError):
                        pass
                if 'NetVolume' in props and quantities['NetVolume'] is None:
                    try:
                        quantities['NetVolume'] = float(props['NetVolume'])
                    except (ValueError, TypeError):
                        pass
                
                # Length
                if 'Length' in props and quantities['Length'] is None:
                    try:
                        quantities['Length'] = float(props['Length'])
                    except (ValueError, TypeError):
                        pass
                
                # Areas
                if 'GrossArea' in props and quantities['GrossArea'] is None:
                    try:
                        quantities['GrossArea'] = float(props['GrossArea'])
                    except (ValueError, TypeError):
                        pass
                if 'NetArea' in props and quantities['NetArea'] is None:
                    try:
                        quantities['NetArea'] = float(props['NetArea'])
                    except (ValueError, TypeError):
                        pass
        
        # Try IfcElementQuantity relationships
        if hasattr(element, 'IsDefinedBy'):
            for rel in element.IsDefinedBy:
                if rel.is_a('IfcRelDefinesByProperties'):
                    prop_def = rel.RelatingPropertyDefinition
                    if prop_def.is_a('IfcElementQuantity'):
                        for quantity in prop_def.Quantities:
                            # Volume
                            if quantity.is_a('IfcQuantityVolume'):
                                if hasattr(quantity, 'VolumeValue') and quantity.VolumeValue:
                                    vol_value = float(quantity.VolumeValue)
                                    if hasattr(quantity, 'Name'):
                                        qty_name = quantity.Name
                                        if 'Gross' in qty_name or quantities['GrossVolume'] is None:
                                            quantities['GrossVolume'] = vol_value
                                        elif 'Net' in qty_name or quantities['NetVolume'] is None:
                                            quantities['NetVolume'] = vol_value
                            
                            # Length
                            elif quantity.is_a('IfcQuantityLength'):
                                if hasattr(quantity, 'LengthValue') and quantity.LengthValue:
                                    if quantities['Length'] is None:
                                        quantities['Length'] = float(quantity.LengthValue)
                            
                            # Area
                            elif quantity.is_a('IfcQuantityArea'):
                                if hasattr(quantity, 'AreaValue') and quantity.AreaValue:
                                    area_value = float(quantity.AreaValue)
                                    if hasattr(quantity, 'Name'):
                                        qty_name = quantity.Name
                                        if 'Gross' in qty_name:
                                            if 'Footprint' in qty_name and quantities['GrossFootprintArea'] is None:
                                                quantities['GrossFootprintArea'] = area_value
                                            elif 'Side' in qty_name and quantities['GrossSideArea'] is None:
                                                quantities['GrossSideArea'] = area_value
                                            elif 'Surface' in qty_name and quantities['GrossSurfaceArea'] is None:
                                                quantities['GrossSurfaceArea'] = area_value
                                            elif quantities['GrossArea'] is None:
                                                quantities['GrossArea'] = area_value
                                        elif 'Net' in qty_name:
                                            if 'Footprint' in qty_name and quantities['NetFootprintArea'] is None:
                                                quantities['NetFootprintArea'] = area_value
                                            elif 'Side' in qty_name and quantities['NetSideArea'] is None:
                                                quantities['NetSideArea'] = area_value
                                            elif 'Surface' in qty_name and quantities['NetSurfaceArea'] is None:
                                                quantities['NetSurfaceArea'] = area_value
                                            elif quantities['NetArea'] is None:
                                                quantities['NetArea'] = area_value
                                    elif quantities['GrossArea'] is None:
                                        quantities['GrossArea'] = area_value
    except:
        pass
    
    return quantities


def main():
    # Load IFC file
    ifc_file = "08_architecture-model-simple.ifc"
    print(f"📂 Loading IFC file: {ifc_file}")
    
    model = ifcopenshell.open(ifc_file)
    elements = model.by_type('IfcElement')
    print(f"✅ Model loaded: {model.schema} | {len(elements)} elements")
    
    # Extract data
    lca_data = []
    elements_without_volume = 0
    
    print(f"\n🔍 Extracting data from {len(elements)} elements...")
    
    for element in elements:
        element_guid = get_element_guid(element)
        ifc_class = get_ifc_class(element)
        material_name = get_material_name(element)
        building_storey = get_building_storey(element)
        classification_code, classification_name = get_classification(element, model)
        quantities = get_quantities(element)
        type_name = get_type_name(element, material_name)
        
        # Use GrossVolume if available, otherwise NetVolume, otherwise None
        volume_value = quantities['GrossVolume'] or quantities['NetVolume']
        
        if volume_value is None:
            elements_without_volume += 1
            continue
        
        lca_data.append({
            'GUID': element_guid,
            'IFCClass': ifc_class,
            'Material': material_name,
            'TypeName': type_name,
            'BuildingStorey': building_storey,
            'ClassificationCode': classification_code,
            'ClassificationName': classification_name,
            'GrossVolume': quantities['GrossVolume'] if quantities['GrossVolume'] is not None else '',
            'NetVolume': quantities['NetVolume'] if quantities['NetVolume'] is not None else '',
            'Length': quantities['Length'] if quantities['Length'] is not None else '',
            'GrossArea': quantities['GrossArea'] if quantities['GrossArea'] is not None else '',
            'NetArea': quantities['NetArea'] if quantities['NetArea'] is not None else '',
            'GrossFootprintArea': quantities['GrossFootprintArea'] if quantities['GrossFootprintArea'] is not None else '',
            'NetFootprintArea': quantities['NetFootprintArea'] if quantities['NetFootprintArea'] is not None else '',
            'GrossSideArea': quantities['GrossSideArea'] if quantities['GrossSideArea'] is not None else '',
            'NetSideArea': quantities['NetSideArea'] if quantities['NetSideArea'] is not None else '',
            'GrossSurfaceArea': quantities['GrossSurfaceArea'] if quantities['GrossSurfaceArea'] is not None else '',
            'NetSurfaceArea': quantities['NetSurfaceArea'] if quantities['NetSurfaceArea'] is not None else '',
            'Menge': volume_value  # Keep for backward compatibility
        })
    
    print(f"✅ {len(lca_data)} elements with volume extracted")
    print(f"   ⚠️  {elements_without_volume} elements without volume skipped")
    
    # Create DataFrame and export
    if lca_data:
        df = pd.DataFrame(lca_data)
        
        # Statistics
        total_volume = df['Menge'].sum()
        print(f"\n📊 Total volume: {total_volume:,.2f} m³")
        
        # Count available quantities
        print("\n📏 Available quantities:")
        quantity_cols = ['GrossVolume', 'NetVolume', 'Length', 'GrossArea', 'NetArea', 
                        'GrossFootprintArea', 'NetFootprintArea', 'GrossSideArea', 'NetSideArea',
                        'GrossSurfaceArea', 'NetSurfaceArea']
        for col in quantity_cols:
            if col in df.columns:
                count = df[col].notna().sum() if df[col].dtype != 'object' else (df[col] != '').sum()
                if count > 0:
                    print(f"   {col}: {count} elements")
        
        # Export CSV with proper quoting for fields containing commas
        output_file = 'lca_base_quantities.csv'
        import csv
        df.to_csv(output_file, index=False, encoding='utf-8-sig', quoting=csv.QUOTE_MINIMAL, quotechar='"', escapechar=None)
        
        print(f"\n✅ CSV saved: {output_file}")
        print(f"   Rows: {len(df):,}")
        print(f"   Columns: {', '.join(df.columns)}")
        
        # Show preview
        print("\n📋 Preview (first 10 rows):")
        print(df.head(10).to_string())
        
        # Statistics by storey
        if len(df['BuildingStorey'].unique()) > 1:
            print("\n🏢 Volume by Building Storey:")
            storey_summary = df.groupby('BuildingStorey')['Menge'].agg(['sum', 'count']).round(2)
            storey_summary.columns = ['Volume (m³)', 'Count']
            print(storey_summary.to_string())
        
        # Statistics by classification
        if df['ClassificationCode'].notna().any() or df['ClassificationName'].notna().any():
            print("\n📚 Elements with classifications:")
            classified = df[(df['ClassificationCode'] != '') | (df['ClassificationName'] != '')]
            print(f"   {len(classified)} elements have classifications")
            if len(classified) > 0:
                print("\n   Classification codes:")
                code_counts = classified['ClassificationCode'].value_counts().head(10)
                for code, count in code_counts.items():
                    if code:
                        print(f"     {code}: {count} elements")
    else:
        print("\n❌ No data to export!")


if __name__ == "__main__":
    main()

