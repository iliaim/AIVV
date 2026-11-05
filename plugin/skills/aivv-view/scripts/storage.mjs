#!/usr/bin/env node
// Read-only bridge for shell viewers. Roots are injectable only through the
// exported JavaScript entrypoint, never through public CLI/environment flags.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

export async function main(argv, options = {}) {
  const [runtimeRoot, command, ...args] = argv;
  const { resolveStorage, ensureReportCache, readStorageContext, withExistingStorageReadLock, validateContainedPath } = await import(pathToFileURL(path.join(runtimeRoot, 'tools/storage-paths.mjs')));
  const { isImportPathVisible } = await import(pathToFileURL(path.join(runtimeRoot, 'tools/state-import.mjs')));
  function visible(file) {
    let directory = path.dirname(path.resolve(file));
    while (directory !== path.dirname(directory)) {
      if (path.basename(directory) === 'state') return isImportPathVisible({ state_dir: directory, target_dir: path.dirname(directory) }, file);
      directory = path.dirname(directory);
    }
    return true;
  }
  function externalContext(file) {
    let directory=path.resolve(file);
    try { if (!fs.statSync(directory).isDirectory()) directory=path.dirname(directory); } catch {directory=path.dirname(directory);}
    while(directory!==path.dirname(directory)) {
      if(path.basename(directory)==='state' && fs.existsSync(path.join(path.dirname(directory),'target.json'))) {
        const target_dir=path.dirname(directory);
        return {state_dir:directory,target_dir,root:path.dirname(path.dirname(target_dir))};
      }
      directory=path.dirname(directory);
    }
    return null;
  }
  function withRead(file, work) {
    const context=externalContext(file);
    return context ? withExistingStorageReadLock(context,work) : work();
  }
  if (command==='load') {
    const {registryForMatching}=await import(pathToFileURL(path.join(runtimeRoot,'tools/state-compat-index.mjs')));
    const registryArgument=args.indexOf('--wont-fix');
    const requestedRegistry=registryArgument>=0 ? path.resolve(args[registryArgument+1]) : null;
    const directories=new Map();
    const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'aivv-view-read-'));
    try {
      const childArgs=[...args];
      for(let i=0;i<childArgs.length;i++) {
        if(!['--file','--fix-dir','--wont-fix'].includes(childArgs[i]) || !childArgs[i+1]) continue;
        const original=childArgs[i+1];
        const context=externalContext(original);
        if(!context) {i++;continue;}
        if(!directories.has(context.state_dir)) {
          const destination=path.join(scratch,String(directories.size),'state');
          fs.mkdirSync(destination,{recursive:true,mode:0o700});
          withRead(context.state_dir,()=>{
            function copy(directory,relative='') {
              if(!fs.existsSync(directory)) return;
              for(const name of fs.readdirSync(directory)) {
                const source=path.join(directory,name);
                validateContainedPath(source,context.state_dir);
                if(fs.statSync(source).isDirectory()) {
                  if(['archive','incidents','problems','issues'].includes(name)) copy(source,path.join(relative,name));
                } else if(name.endsWith('.json') && visible(source)) {
                  const output=path.join(destination,relative,name);
                  fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
                  fs.copyFileSync(source,output);fs.chmodSync(output,0o600);
                }
              }
            }
            copy(context.state_dir);
            const registryRelative=requestedRegistry && path.relative(context.state_dir,requestedRegistry);
            const registryFile=registryRelative && registryRelative!=='..' && !registryRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(registryRelative) ? path.join(destination,registryRelative) : null;
            if(registryFile && fs.existsSync(registryFile)) {
              const target=JSON.parse(fs.readFileSync(path.join(context.target_dir,'target.json'),'utf8')).identity.target;
              const matching=registryForMatching(JSON.parse(fs.readFileSync(registryFile,'utf8')),target);
              fs.writeFileSync(registryFile,JSON.stringify(matching),{mode:0o600});
              for(const warning of matching.warnings ?? []) process.stderr.write(`aivv view: ${warning.code}: registry entry ${warning.entry_index} skipped for compatibility matching.\n`);
            }
          });
          directories.set(context.state_dir,destination);
        }
        childArgs[i+1]=path.join(directories.get(context.state_dir),path.relative(context.state_dir,path.resolve(original)));
        i++;
      }
      const result=spawnSync('bash',[path.join(path.dirname(fileURLToPath(import.meta.url)),'loader-content.sh'),...childArgs],{encoding:'utf8',maxBuffer:64*1024*1024});
      if(result.error) throw result.error;
      function restoreSourcePaths(value) {
        if(typeof value==='string') {
          for(const [source,snapshot] of directories) if(value===snapshot || value.startsWith(`${snapshot}${path.sep}`)) return `${source}${value.slice(snapshot.length)}`;
          return value;
        }
        if(Array.isArray(value)) return value.map(restoreSourcePaths);
        if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,restoreSourcePaths(item)]));
        return value;
      }
      let stdout=result.stdout ?? '';
      if(result.status===0 && stdout.trim()) stdout=`${JSON.stringify(restoreSourcePaths(JSON.parse(stdout)))}\n`;
      let stderr=result.stderr ?? '';
      for(const [source,snapshot] of directories) stderr=stderr.split(snapshot).join(source);
      process.stdout.write(stdout);process.stderr.write(stderr);
      process.exitCode=result.status ?? 70;
    } finally {fs.rmSync(scratch,{recursive:true,force:true});}
    return;
  }
  if (command === 'timestamp') {
    withRead(args[0],()=>{
      if(!visible(args[0])) return;
      try {process.stdout.write(`${JSON.parse(fs.readFileSync(args[0],'utf8')).invoked_at ?? ''}\n`);} catch {}
    });
    return;
  }
  if (command === 'visible') {
    process.exitCode = visible(args[0]) ? 0 : 65;
    return;
  }
  const contextIndex = args.indexOf("--storage-context");
  const contextFile = contextIndex >= 0 ? args.splice(contextIndex, 2)[1] : null;
  const context = contextFile ? readStorageContext(contextFile) : resolveStorage(options);
  if (command === 'context') process.stdout.write(`${JSON.stringify(context)}\n`);
  else if (command === 'cache') { ensureReportCache(context); process.stdout.write(`${context.reports_dir}\n`); }
  else if (command === 'reviews' || command==='list') {
    const rows=[];
    const directories = args[1] === 'history' ? [args[0], ...context.legacy_state_dirs] : [args[0]];
    const seen = new Set();
    for (const directory of [...new Set(directories)]) {
      for (const candidateDir of [directory, path.join(directory, 'archive')]) {
        if (!fs.existsSync(candidateDir)) continue;
        withRead(candidateDir,()=>{
        for (const name of fs.readdirSync(candidateDir).sort()) {
          if (!/^review-.*\.json$/.test(name)) continue;
          const file = path.join(candidateDir, name);
          if (!fs.statSync(file).isFile() || !visible(file)) continue;
          if (seen.has(name)) {
            process.stderr.write(`aivv view: duplicate review log '${name}' in state/archive/history; using first copy.\n`);
            continue;
          }
          seen.add(name);
          if(command==='reviews') process.stdout.write(`${file}\n`);
          else {
            try {
              const review=JSON.parse(fs.readFileSync(file,'utf8'));
              const findings=review.findings;
              const finding_count=Array.isArray(findings)||typeof findings==='string' ? findings.length : findings && typeof findings==='object' ? Object.keys(findings).length : 0;
              rows.push({review_id:review.id??review.review_id??null,finding_count,lens:review.lens??null,reviewers:review.reviewers??null,review_mode:review.review_mode??null,status:review.status??null,invoked_at:review.invoked_at??null});
            } catch {
              rows.push({review_id:name.slice(7,-5),finding_count:0,lens:null,reviewers:null,review_mode:null,status:'list-error',invoked_at:null,warning:'list_parse_error'});
            }
          }
        }
        });
      }
    }
    if(command==='list') process.stdout.write(`${JSON.stringify(rows.sort((a,b)=>String(b.invoked_at??'').localeCompare(String(a.invoked_at??''))))}\n`);
  } else throw new Error(`unknown viewer storage operation ${command}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`aivv view: ${error.message}\n`); process.exitCode = 65; });
}
