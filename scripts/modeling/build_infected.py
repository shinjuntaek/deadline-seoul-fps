"""Offline CC0 MakeHuman asset conversion, run with Blender 4.3.2.
blender -b -t 2 --python scripts/modeling/build_infected.py -- SOURCE_DIRECTORY
Runtime never requires Blender or downloads from MakeHuman.
"""
import bpy, json, math, sys, pathlib, random
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=pathlib.Path(sys.argv[sys.argv.index('--')+1])
OUT=ROOT/'assets/models';OUT.mkdir(parents=True,exist_ok=True)
vertices=[];uvs=[];groups={};group=''
for line in (SOURCE/'base.obj').read_text().splitlines():
    if line.startswith('v '):vertices.append(Vector(map(float,line.split()[1:])))
    elif line.startswith('vt '):uvs.append(tuple(map(float,line.split()[1:])))
    elif line.startswith('g '):group=line[2:];groups.setdefault(group,[])
    elif line.startswith('f '):groups[group].append([tuple(int(v)-1 for v in c.split('/')[:2]) for c in line.split()[1:]])
rigdata=json.loads((SOURCE/'default.mhskel').read_text())
weights=json.loads((SOURCE/'default_weights.mhw').read_text())['weights']
body_ids=sorted({v for f in groups['body'] for v,t in f})
floor=min(vertices[i].y for i in body_ids)
scale=2.20/(max(vertices[i].y for i in body_ids)-floor)
def point(v):return Vector((v.x*scale,-v.z*scale,(v.y-floor)*scale))
def joint(n):
    ids=rigdata['joints'][n]
    return point(sum((vertices[i] for i in ids),Vector())/len(ids))
def name(n):return n.replace('.','_')
keep={n for n in rigdata['bones'] if n=='root' or n.startswith(('spine','neck','head','jaw','clavicle','shoulder','upperarm','lowerarm','wrist','pelvis','upperleg','lowerleg','foot'))}
def mapped(n):
    while n not in keep:n=rigdata['bones'][n]['parent'] or 'root'
    return n
vw={i:{} for i in body_ids}
for bone,values in weights.items():
    target=mapped(bone)
    for i,w in values:
        if i in vw:vw[i][target]=vw[i].get(target,0)+w
kd=KDTree(len(body_ids))
for i in body_ids:kd.insert(vertices[i],i)
kd.balance()

def material(n,color,rough=.8,metal=0,texture=None):
    m=bpy.data.materials.new(n);m.use_nodes=True;m.diffuse_color=(*color,1)
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if texture:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/materials'/texture),check_existing=True)
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Tint'
    if texture:
        mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
        m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(attr.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
    else:m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    return m

def skeleton():
    data=bpy.data.armatures.new('SeoulHumanoid');obj=bpy.data.objects.new('SeoulHumanoid',data);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for n in keep:
        b=data.edit_bones.new(name(n));b.head=joint(rigdata['bones'][n]['head']);b.tail=joint(rigdata['bones'][n]['tail']);b.align_roll(Vector((0,1,0)))
        if (b.tail-b.head).length<.001:b.tail.z+=.01
    for n in keep:
        p=rigdata['bones'][n]['parent']
        if p:data.edit_bones[name(n)].parent=data.edit_bones[name(mapped(p))]
    bpy.ops.object.mode_set(mode='OBJECT');obj.select_set(False)
    return obj

def make_mesh(n,faces,arm,materials,variant,helper=False):
    ids=sorted({v for f in faces for v,t in f});remap={old:new for new,old in enumerate(ids)}
    coords=[point(vertices[i]) for i in ids]
    mesh=bpy.data.meshes.new(n);mesh.from_pydata(coords,[],[[remap[v] for v,t in f] for f in faces]);mesh.update()
    ob=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(ob)
    for m in materials:mesh.materials.append(m)
    uv=mesh.uv_layers.new(name='UVMap');tint=mesh.color_attributes.new(name='Tint',type='BYTE_COLOR',domain='CORNER')
    for poly,face in zip(mesh.polygons,faces):
        cy=sum(vertices[v].y for v,t in face)/len(face)
        is_pants=helper and cy<.8;matidx=1 if is_pants else 0
        poly.material_index=matidx;poly.use_smooth=True
        for li,(vi,ti) in zip(poly.loop_indices,face):
            uv.data[li].uv=uvs[ti] if not helper else (uvs[ti][0]*4,uvs[ti][1]*4)
            p=vertices[vi];noise=.9+.1*math.sin(vi*71.7)
            if helper:
                color=([.20,.25,.27] if is_pants else ([.25,.34,.29] if variant==0 else [.48,.29,.16]))
                stain=(math.sin(p.x*4+p.y*2)*math.sin(p.y*7+p.z*5)>.62)
                color=[c*(.55 if stain else 1)*noise for c in color]
            else:
                color=[.48,.49,.41] if variant==0 else [.53,.47,.38]
                # Small mottled bruising and face shadows, not a photo billboard.
                spot=math.sin(p.x*16+p.y*11)*math.sin(p.y*19-p.z*6)>.56
                color=[c*noise*(.62 if spot else 1) for c in color]
                if p.y< -6.7:color=[.045,.055,.055]
            tint.data[li].color=(*color,1)
    for bone in keep:ob.vertex_groups.new(name=name(bone))
    for ni,oi in enumerate(ids):
        source=oi if oi in vw else kd.find(vertices[oi])[1]
        values=sorted(vw[source].items(),key=lambda x:-x[1])[:4];total=sum(w for b,w in values) or 1
        for bone,w in values:ob.vertex_groups[name(bone)].add([ni],w/total,'REPLACE')
    # Reduce mesh while preserving skin weights. Keep anatomy in the near LOD.
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    dec=ob.modifiers.new('Budget','DECIMATE');dec.ratio=.55 if helper else .28;bpy.ops.object.modifier_apply(modifier=dec.name)
    mod=ob.modifiers.new('HumanoidSkin','ARMATURE');mod.object=arm;ob.parent=arm;ob.select_set(False)
    return ob

def rigid(n,location,size,mat,arm,bone='spine01',sphere=False):
    if sphere:bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=location)
    else:bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    ob=bpy.context.object;ob.name=n;ob.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if not sphere:
        be=ob.modifiers.new('SoftEdges','BEVEL');be.width=.007;be.segments=2;bpy.ops.object.modifier_apply(modifier=be.name)
    ob.data.materials.append(mat);col=ob.data.color_attributes.new(name='Tint',type='BYTE_COLOR',domain='CORNER')
    for d in col.data:d.color=mat.diffuse_color
    for p in ob.data.polygons:p.use_smooth=True
    vg=ob.vertex_groups.new(name=name(bone));vg.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('HumanoidSkin','ARMATURE');mod.object=arm;ob.parent=arm;ob.select_set(False)
    return ob

audit=[]
for variant,label in enumerate(['infected-civilian','infected-worker']):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    arm=skeleton()
    skin=material('Pallid skin',(.5,.5,.4),.79)
    coat=material('Weathered cloth',(.3,.35,.3),.91,texture='fabric.webp')
    pants=material('Work trousers',(.2,.24,.25),.88,texture='fabric.webp')
    leather=material('Rubber leather',(.04,.05,.045),.7)
    # Only exposed skin and shoes remain; the separate fitted garment covers the torso.
    exposed=[]
    for f in groups['body']:
        p=sum((vertices[v] for v,t in f),Vector())/len(f)
        if p.y>5.65 or abs(p.x)>3.55 or p.y< -6.7:exposed.append(f)
    make_mesh('Anatomy',exposed,arm,[skin],variant)
    make_mesh('Clothed body',groups['helper-tights'],arm,[coat,pants],variant,True)
    eyeMat=material('Clouded eyes',(.73,.75,.62),.3)
    for side in ['L','R']:
        center=joint(rigdata['bones']['eye.'+side]['head']);center.y-=.012
        rigid('Eye '+side,center,(.026,.023,.022),eyeMat,arm,'head',True)
        iris=material('Iris '+side,(.17,.13,.09),.4)
        rigid('Iris '+side,center+Vector((0,-.021,0)),(.010,.004,.010),iris,arm,'head',True)
    # Shirt placket, pockets and collar follow the chest skeleton.
    chest=joint(rigdata['bones']['spine01']['head'])
    for side in [-1,1]:
        rigid('Chest pocket',chest+Vector((side*.12,-.145,.04)),(.085,.018,.105),coat,arm)
        collar=rigid('Collar',chest+Vector((side*.055,-.11,.18)),(.05,.024,.085),coat,arm)
    for i in range(4):rigid('Button',chest+Vector((0,-.165,.1-i*.065)),(.006,.004,.006),leather,arm,'spine02',True)
    belt=joint(rigdata['bones']['spine05']['head'])
    rigid('Belt buckle',belt+Vector((0,-.13,0)),(.045,.02,.032),leather,arm,'spine05')
    if variant:
        vest=material('Faded rescue vest',(.56,.30,.11),.9)
        reflective=material('Faded reflector',(.62,.67,.57),.5)
        for side in [-1,1]:
            rigid('Vest panel',chest+Vector((side*.12,-.157,.02)),(.11,.026,.28),vest,arm)
            rigid('Reflective strip',chest+Vector((side*.12,-.175,.01)),(.112,.008,.018),reflective,arm)
    else:
        # A hair cap from the true head surface retains the anatomical silhouette.
        hair=material('Short wet hair',(.04,.035,.025),.7)
        hf=[f for f in groups['body'] if all(vertices[v].y>7.58 and (vertices[v].z<.7 or vertices[v].y>8.05) for v,t in f)]
        h=make_mesh('Hair',hf,arm,[hair],variant)
        for d in h.data.color_attributes['Tint'].data:d.color=(.035,.032,.027,1)
        for v in h.data.vertices:v.co+=v.normal*.003
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    # Merge all pieces to one skinned object (material primitives remain separate).
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name=label
    # Vertex tints retain different skin/cloth/eye colours with only two draws.
    previous=list(body.data.materials)
    for p in body.data.polygons:p.material_index=1 if ('cloth' in previous[p.material_index].name.lower() or 'trousers' in previous[p.material_index].name.lower()) else 0
    body.data.materials[0]=skin;body.data.materials[1]=coat
    # No morphs, cameras, lights or hidden source anatomy in runtime GLB.
    for lod,ratio in [('near',1),('far',.20)]:
        if ratio<1:
            dec=body.modifiers.new('DistanceLOD','DECIMATE');dec.ratio=ratio;bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
        bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);body.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/(label+'-'+lod+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_materials='EXPORT',export_yup=True)
        tris=sum(len(p.vertices)-2 for p in body.data.polygons)
        audit.append({'model':label,'lod':lod,'triangles':tris,'bones':len(arm.data.bones),'materials':len({p.material_index for p in body.data.polygons}),'heightMeters':2.20,'file':label+'-'+lod+'.glb'})
(OUT/'model-audit.json').write_text(json.dumps(audit,indent=2))
print('MODEL_AUDIT',json.dumps(audit))
